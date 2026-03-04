import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarJobsCached, getCalendarJobsRaw } from '@/lib/publications-cache'

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const start = request.nextUrl.searchParams.get('start')
    const end = request.nextUrl.searchParams.get('end')
    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'Missing start or end query parameter' },
        { status: 400 }
      )
    }

    const forceFresh = request.nextUrl.searchParams.get('fresh') === '1'
    const jobs = forceFresh
      ? await getCalendarJobsRaw(start, end)
      : await getCalendarJobsCached(start, end)

    return NextResponse.json(
      { success: true, jobs: jobs || [] },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}
