import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const [recipesResult, jobsResult] = await Promise.all([
      adminDb.from('publish_recipes').select('platform, is_main').eq('is_active', true),
      adminDb
        .from('publish_jobs')
        .select(
          `
            id, news_id, review_id, platform, status, publish_at, created_at, updated_at,
            social_content, published_url, retry_count, error_message, external_id, published_at_actual,
            news_items (
              id, title, draft_title, draft_image_file_id, gate1_tags, draft_longread_site,
              draft_announce_tg, draft_announce_vk, draft_announce_ok, draft_announce_fb, draft_announce_x, draft_announce_threads
            ),
            review_items (
              id, title_seed, draft_title, draft_image_file_id, draft_longread_site,
              draft_announce_tg, draft_announce_vk, draft_announce_ok, draft_announce_fb, draft_announce_x, draft_announce_threads
            )
          `
        )
        .order('publish_at', { ascending: true }),
    ])

    if (recipesResult.error) {
      return NextResponse.json(
        { success: false, error: recipesResult.error.message || 'Failed to load recipes' },
        { status: 500 }
      )
    }

    if (jobsResult.error) {
      return NextResponse.json(
        { success: false, error: jobsResult.error.message || 'Failed to load jobs' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        recipes: recipesResult.data || [],
        jobs: jobsResult.data || [],
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}

