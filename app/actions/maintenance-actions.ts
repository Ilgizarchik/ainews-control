'use server'
import { revalidatePath } from 'next/cache'

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createClient } from '@/lib/supabase/server'
import {
    ensureBackupLocalDir,
    getBackupAbsolutePath,
    getBackupLocalDir,
    getLocalBackups,
    isValidBackupFilename,
} from '@/lib/backup-storage'

const execPromise = promisify(exec)

async function requireAuthorizedUser() {
    const sessionClient = await createClient()
    const { data: { user }, error } = await sessionClient.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
}

export async function createSystemBackup() {
    let tempDir = ''
    let tempBackupPath = ''
    try {
        await requireAuthorizedUser()
        const backupDir = ensureBackupLocalDir()

        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
        const backupName = `full_system_backup_${timestamp}.tar.gz`
        tempDir = path.join(os.tmpdir(), `backup_${timestamp}`)
        tempBackupPath = path.join(os.tmpdir(), backupName)
        const finalBackupPath = getBackupAbsolutePath(backupName)
        const sqlDumpPath = path.join(tempDir, 'supabase_backup.sql')

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
        if (!supabaseDbUrl) {
            return { success: false, error: 'SUPABASE_DB_URL is not configured on server' }
        }

        console.log('[Backup] Starting Supabase DB dump...')
        await execPromise(`pg_dump "$BACKUP_DB_URL" > "${sqlDumpPath}"`, {
            env: { ...process.env, BACKUP_DB_URL: supabaseDbUrl }
        })

        // 2. Архивируем все: исходники проекта + дамп БД
        console.log('[Backup] Archiving everything (Source + DB)...')

        const projectRoot = process.cwd()
        const backupDirRelativeToProject = path
            .relative(projectRoot, backupDir)
            .replaceAll('\\', '/')
        const backupDirInsideProject =
            backupDirRelativeToProject &&
            backupDirRelativeToProject !== '.' &&
            !backupDirRelativeToProject.startsWith('..')

        const tarParts = [
            `tar -czf "${tempBackupPath}"`,
            '--exclude=node_modules',
            '--exclude=.next',
            '--exclude=.git',
            '--exclude=.venv',
            '--exclude=logs',
            '--exclude=public/full_system_backup_*.tar.gz',
        ]

        if (backupDirInsideProject) {
            tarParts.push(`--exclude="${backupDirRelativeToProject}"`)
            tarParts.push(`--exclude="${backupDirRelativeToProject}/*"`)
        }

        tarParts.push(`-C "${projectRoot}" .`)
        tarParts.push(`-C "${tempDir}" supabase_backup.sql`)
        await execPromise(tarParts.join(' '))

        fs.copyFileSync(tempBackupPath, finalBackupPath)

        console.log(`[Backup] Created locally: ${finalBackupPath}`)
        revalidatePath('/settings')

        return {
            success: true,
            filename: backupName,
            downloadUrl: `/api/maintenance/download/${encodeURIComponent(backupName)}`
        }
    } catch (error: any) {
        console.error('[Backup] Error:', error)
        return { success: false, error: error.message }
    } finally {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
        if (tempBackupPath && fs.existsSync(tempBackupPath)) {
            fs.rmSync(tempBackupPath, { force: true })
        }
    }
}

export async function getRecentBackups() {
    try {
        await requireAuthorizedUser()
        const backups = getLocalBackups()

        return { success: true, backups }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteBackup(filename: string) {
    try {
        await requireAuthorizedUser()

        if (!isValidBackupFilename(filename)) {
            return { success: false, error: 'Invalid filename' }
        }

        const localPath = path.join(getBackupLocalDir(), filename)
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath)
            revalidatePath('/settings')
            return { success: true }
        }

        // Backward compatibility for legacy local backups in /public
        const legacyPublicPath = path.join(process.cwd(), 'public', filename)
        if (fs.existsSync(legacyPublicPath)) {
            fs.unlinkSync(legacyPublicPath)
            revalidatePath('/settings')
            return { success: true }
        }

        return { success: false, error: 'Backup not found' }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
