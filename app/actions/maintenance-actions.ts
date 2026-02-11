'use server'
import { revalidatePath } from 'next/cache'

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createAdminClient } from '@/lib/supabase/admin'

const execPromise = promisify(exec)

export async function createSystemBackup() {
    try {
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
        const backupName = `full_system_backup_${timestamp}.tar.gz`
        const publicPath = path.join(process.cwd(), 'public')
        const backupPath = path.join(publicPath, backupName)
        const tempDir = path.join(os.tmpdir(), `backup_${timestamp}`)

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        // 1. Get Supabase Connection String from environment or settings
        // For security, we'll try to find it in settings if not in process.env
        const supabaseUrl = 'postgresql://postgres.rshqequtbqvrqbgfykhq:ZPz-M2F-T7i-5qR@aws-1-eu-west-3.pooler.supabase.com:6543/postgres'

        console.log('[Backup] Starting Supabase DB dump...')
        await execPromise(`pg_dump "${supabaseUrl}" > ${path.join(tempDir, 'supabase_backup.sql')}`)

        // 2. Archive everything: Project Source + DB Dumps
        console.log('[Backup] Archiving everything (Source + DB)...')

        const projectRoot = process.cwd()
        const tempBackupPath = path.join(os.tmpdir(), backupName)

        // Command explanation:
        // Create archive in /tmp to avoid "file changed as we read it" error
        // --exclude... : skip heavy/temp folders
        await execPromise(`tar -czf "${tempBackupPath}" \
            --exclude=node_modules \
            --exclude=.next \
            --exclude=.git \
            --exclude="public/full_system_backup_*.tar.gz" \
            -C "${projectRoot}" . \
            -C "${tempDir}" .`)

        // 3. Move archive to public destination
        fs.renameSync(tempBackupPath, backupPath)

        // 4. Cleanup temp
        fs.rmSync(tempDir, { recursive: true, force: true })

        console.log(`[Backup] Created successfully in ${publicPath}: ${backupName}`)
        revalidatePath('/settings')

        return {
            success: true,
            filename: backupName,
            downloadUrl: `/api/maintenance/download/${backupName}`
        }
    } catch (error: any) {
        console.error('[Backup] Error:', error)
        return { success: false, error: error.message }
    }
}

export async function getRecentBackups() {
    try {
        const publicPath = path.join(process.cwd(), 'public')
        const files = fs.readdirSync(publicPath)
        const backups = files
            .filter(f => f.startsWith('full_system_backup_') && f.endsWith('.tar.gz'))
            .map(f => {
                const stats = fs.statSync(path.join(publicPath, f))
                return {
                    name: f,
                    size: stats.size,
                    createdAt: stats.birthtime.toISOString(),
                    url: `/api/maintenance/download/${f}`
                }
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        return { success: true, backups }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteBackup(filename: string) {
    try {
        const publicPath = path.join(process.cwd(), 'public')
        const filePath = path.join(publicPath, filename)
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            revalidatePath('/settings')
            return { success: true }
        }
        return { success: false, error: 'File not found' }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
