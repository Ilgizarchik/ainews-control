import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLocalBackups } from '@/lib/backup-storage'

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

    const backups = getLocalBackups()
    return NextResponse.json({ success: true, backups }, { status: 200 })
  } catch (error: any) {
    console.error('[Maintenance API] Failed to load backups list:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}

