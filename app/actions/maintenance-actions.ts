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

        // 2. Dump local n8n database (if accessible via network)
        // Note: This assumes the container name/host is 'postgres' as per docker-compose
        try {
            console.log('[Backup] Starting n8n DB dump...')
            const n8nDbPass = process.env.N8N_DB_PASSWORD || ''
            await execPromise(`PGPASSWORD="${n8nDbPass}" pg_dump -h postgres -U n8n n8n > ${path.join(tempDir, 'n8n_backup.sql')}`)
        } catch (e) {
            console.warn('[Backup] Failed to dump n8n DB (maybe not accessible):', e)
        }

        // 3. Copy important configs if we can find them
        // In the runner stage, we have .env, server.js, etc.
        const filesToCopy = ['.env', 'package.json']
        for (const file of filesToCopy) {
            const filePath = path.join(process.cwd(), file)
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, path.join(tempDir, file))
            }
        }

        // 4. Archive everything
        console.log('[Backup] Archiving files...')
        // We include the current source code (excluding node_modules and .next for size)
        // But since we are in standalone mode, /app is already clean.
        await execPromise(`tar -czf "${backupPath}" -C "${tempDir}" .`)

        // 5. Cleanup temp
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
