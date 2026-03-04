import fs from 'fs'
import path from 'path'

export type BackupItem = {
  name: string
  size: number
  createdAt: string
  url: string
}

const BACKUP_PREFIX = 'full_system_backup_'
const BACKUP_SUFFIX = '.tar.gz'

export const MAX_BACKUPS_IN_RESPONSE = Math.min(
  Math.max(Number(process.env.BACKUP_LIST_MAX || '100') || 100, 10),
  500
)

const MAX_LOCAL_SCAN_MATCHES = MAX_BACKUPS_IN_RESPONSE * 10

export function getBackupLocalDir() {
  const configuredDir = process.env.BACKUP_LOCAL_DIR?.trim()
  if (configuredDir) return configuredDir
  return path.join(process.cwd(), 'backups')
}

export function ensureBackupLocalDir() {
  const backupDir = getBackupLocalDir()
  fs.mkdirSync(backupDir, { recursive: true })
  return backupDir
}

export function isBackupFilename(filename: string) {
  return filename.startsWith(BACKUP_PREFIX) && filename.endsWith(BACKUP_SUFFIX)
}

export function isValidBackupFilename(filename: string) {
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false
  }
  return isBackupFilename(filename)
}

export function getBackupAbsolutePath(filename: string) {
  return path.join(getBackupLocalDir(), filename)
}

export function getLocalBackups() {
  const backupDir = ensureBackupLocalDir()
  const matchedNames: string[] = []
  const dir = fs.opendirSync(backupDir)

  try {
    let entry = dir.readSync()
    while (entry) {
      if (entry.isFile() && isBackupFilename(entry.name)) {
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
    .slice(0, MAX_BACKUPS_IN_RESPONSE)
    .map((name): BackupItem => {
      const stats = fs.statSync(path.join(backupDir, name))
      return {
        name,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        url: `/api/maintenance/download/${encodeURIComponent(name)}`,
      }
    })
}

