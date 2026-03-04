'use server'
import { revalidatePath } from 'next/cache'

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const execPromise = promisify(exec)
const BACKUP_BUCKET = process.env.BACKUP_STORAGE_BUCKET || 'system-backups'
const MAX_BACKUPS_IN_RESPONSE = Math.min(
    Math.max(Number(process.env.BACKUP_LIST_MAX || '100') || 100, 10),
    500
)

async function requireAuthorizedUser() {
    const sessionClient = await createClient()
    const { data: { user }, error } = await sessionClient.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
}

async function ensureBackupBucket(adminDb: ReturnType<typeof createAdminClient>) {
    const { error: bucketError } = await adminDb.storage.getBucket(BACKUP_BUCKET)
    if (!bucketError) return

    const { error: createError } = await adminDb.storage.createBucket(BACKUP_BUCKET, {
        public: false,
        fileSizeLimit: '4GB'
    })

    if (createError && !/already exists/i.test(createError.message || '')) {
        throw createError
    }
}

export async function createSystemBackup() {
    let tempDir = ''
    let tempBackupPath = ''
    try {
        await requireAuthorizedUser()

        const adminDb = createAdminClient()
        await ensureBackupBucket(adminDb)

        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
        const backupName = `full_system_backup_${timestamp}.tar.gz`
        tempDir = path.join(os.tmpdir(), `backup_${timestamp}`)
        tempBackupPath = path.join(os.tmpdir(), backupName)
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
        await execPromise(`tar -czf "${tempBackupPath}" \
            --exclude=node_modules \
            --exclude=.next \
            --exclude=.git \
            --exclude=.venv \
            --exclude=logs \
            --exclude=public/full_system_backup_*.tar.gz \
            -C "${projectRoot}" . \
            -C "${tempDir}" supabase_backup.sql`)

        // 3. Загружаем архив в Supabase Storage
        const backupBuffer = fs.readFileSync(tempBackupPath)
        const { error: uploadError } = await adminDb.storage
            .from(BACKUP_BUCKET)
            .upload(backupName, backupBuffer, {
                upsert: true,
                contentType: 'application/gzip'
            })

        if (uploadError) {
            throw uploadError
        }

        console.log(`[Backup] Created and uploaded to bucket ${BACKUP_BUCKET}: ${backupName}`)
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

        const adminDb = createAdminClient()
        await ensureBackupBucket(adminDb)

        const { data: files, error } = await adminDb.storage
            .from(BACKUP_BUCKET)
            .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })

        if (error) {
            throw error
        }

        const storageBackups = (files || [])
            .filter(f => f.name.startsWith('full_system_backup_') && f.name.endsWith('.tar.gz'))
            .map(f => ({
                name: f.name,
                size: Number((f.metadata as any)?.size || 0),
                createdAt: (f as any).created_at || (f as any).updated_at || new Date(0).toISOString(),
                url: `/api/maintenance/download/${encodeURIComponent(f.name)}`
            }))
            .slice(0, MAX_BACKUPS_IN_RESPONSE * 2)

        // Backward compatibility: include old local backups from /public
        const publicPath = path.join(process.cwd(), 'public')
        const localBackups = fs.existsSync(publicPath)
            ? fs.readdirSync(publicPath)
                .filter(f => f.startsWith('full_system_backup_') && f.endsWith('.tar.gz'))
                .sort((a, b) => b.localeCompare(a))
                .slice(0, MAX_BACKUPS_IN_RESPONSE * 2)
                .map(f => {
                    const stats = fs.statSync(path.join(publicPath, f))
                    return {
                        name: f,
                        size: stats.size,
                        createdAt: stats.birthtime.toISOString(),
                        url: `/api/maintenance/download/${encodeURIComponent(f)}`
                    }
                })
            : []

        const mergedByName = new Map<string, { name: string; size: number; createdAt: string; url: string }>()
        localBackups.forEach(item => mergedByName.set(item.name, item))
        storageBackups.forEach(item => mergedByName.set(item.name, item))

        const backups = Array.from(mergedByName.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, MAX_BACKUPS_IN_RESPONSE)

        return { success: true, backups }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteBackup(filename: string) {
    try {
        await requireAuthorizedUser()

        const adminDb = createAdminClient()
        await ensureBackupBucket(adminDb)

        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return { success: false, error: 'Invalid filename' }
        }

        const { error } = await adminDb.storage.from(BACKUP_BUCKET).remove([filename])
        // Storage remove can fail for legacy local-only backups; keep going.
        if (error && !/not found/i.test(error.message || '')) {
            return { success: false, error: error.message }
        }

        const legacyPath = path.join(process.cwd(), 'public', filename)
        if (fs.existsSync(legacyPath)) {
            fs.unlinkSync(legacyPath)
        }

        revalidatePath('/settings')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
