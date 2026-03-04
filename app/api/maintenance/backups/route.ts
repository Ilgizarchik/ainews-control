import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BACKUP_BUCKET = process.env.BACKUP_STORAGE_BUCKET || 'system-backups'
const MAX_BACKUPS_IN_RESPONSE = Math.min(
  Math.max(Number(process.env.BACKUP_LIST_MAX || '100') || 100, 10),
  500
)
const MAX_LOCAL_SCAN_MATCHES = MAX_BACKUPS_IN_RESPONSE * 10

type BackupItem = {
  name: string
  size: number
  createdAt: string
  url: string
}

async function ensureBackupBucket(adminDb: ReturnType<typeof createAdminClient>) {
  const { error: bucketError } = await adminDb.storage.getBucket(BACKUP_BUCKET)
  if (!bucketError) return

  const { error: createError } = await adminDb.storage.createBucket(BACKUP_BUCKET, {
    public: false,
    fileSizeLimit: '4GB',
  })

  if (createError && !/already exists/i.test(createError.message || '')) {
    throw createError
  }
}

function getLegacyPublicBackups(publicPath: string): BackupItem[] {
  if (!fs.existsSync(publicPath)) return []

  const matchedNames: string[] = []
  const dir = fs.opendirSync(publicPath)
  try {
    let entry = dir.readSync()
    while (entry) {
      if (
        entry.isFile() &&
        entry.name.startsWith('full_system_backup_') &&
        entry.name.endsWith('.tar.gz')
      ) {
        matchedNames.push(entry.name)
        if (matchedNames.length >= MAX_LOCAL_SCAN_MATCHES) break
      }
      entry = dir.readSync()
    }
  } finally {
    dir.closeSync()
  }

  return matchedNames
    .sort((a, b) => b.localeCompare(a))
    .slice(0, MAX_BACKUPS_IN_RESPONSE * 2)
    .map((name) => {
      const stats = fs.statSync(path.join(publicPath, name))
      return {
        name,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        url: `/api/maintenance/download/${encodeURIComponent(name)}`,
      }
    })
}

export async function GET() {
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const adminDb = createAdminClient()
    await ensureBackupBucket(adminDb)

    const { data: files, error } = await adminDb.storage
      .from(BACKUP_BUCKET)
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })

    if (error) {
      throw error
    }

    const storageBackups: BackupItem[] = (files || [])
      .filter((f) => f.name.startsWith('full_system_backup_') && f.name.endsWith('.tar.gz'))
      .map((f) => ({
        name: f.name,
        size: Number((f.metadata as any)?.size || 0),
        createdAt: (f as any).created_at || (f as any).updated_at || new Date(0).toISOString(),
        url: `/api/maintenance/download/${encodeURIComponent(f.name)}`,
      }))
      .slice(0, MAX_BACKUPS_IN_RESPONSE * 2)

    const localBackups = getLegacyPublicBackups(path.join(process.cwd(), 'public'))
    const mergedByName = new Map<string, BackupItem>()
    localBackups.forEach((item) => mergedByName.set(item.name, item))
    storageBackups.forEach((item) => mergedByName.set(item.name, item))

    const backups = Array.from(mergedByName.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_BACKUPS_IN_RESPONSE)

    return NextResponse.json({ success: true, backups }, { status: 200 })
  } catch (error: any) {
    console.error('[Maintenance API] Failed to load backups list:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}
