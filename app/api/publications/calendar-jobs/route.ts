import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const adminDb = createAdminClient()
    const { data, error } = await adminDb
      .from('publish_jobs')
      .select(
        `
          *,
          news_items (title, draft_title, canonical_url, image_url),
          review_items (title_seed, draft_title)
        `
      )
      .gte('publish_at', start)
      .lt('publish_at', end)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to load jobs' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, jobs: data || [] },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}

