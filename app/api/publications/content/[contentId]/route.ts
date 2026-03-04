import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ContentType = 'news' | 'review'

const NEWS_SELECT_FIELDS =
  'id, title, draft_title, draft_announce, draft_longread, draft_image_prompt, draft_image_url, draft_image_file_id, image_url, gate1_tags, canonical_url, factpack'

const REVIEW_SELECT_FIELDS =
  'id, title_seed, draft_title, draft_announce, draft_longread, draft_image_prompt, draft_image_url, draft_image_file_id, published_url, factpack'

function normalizeType(raw: string | null): ContentType {
  return raw === 'review' ? 'review' : 'news'
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> }
) {
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { contentId } = await context.params
    const expectedType = normalizeType(request.nextUrl.searchParams.get('type'))
    const adminDb = createAdminClient()

    const primaryTable = expectedType === 'review' ? 'review_items' : 'news_items'
    const fallbackTable = expectedType === 'review' ? 'news_items' : 'review_items'
    const primarySelect = primaryTable === 'news_items' ? NEWS_SELECT_FIELDS : REVIEW_SELECT_FIELDS
    const fallbackSelect = fallbackTable === 'news_items' ? NEWS_SELECT_FIELDS : REVIEW_SELECT_FIELDS

    let { data, error } = await (adminDb
      .from(primaryTable as any)
      .select(primarySelect)
      .eq('id', contentId)
      .single() as any)

    let actualTable = primaryTable

    if (error || !data) {
      const fallback = await (adminDb
        .from(fallbackTable as any)
        .select(fallbackSelect)
        .eq('id', contentId)
        .single() as any)

      if (fallback.error || !fallback.data) {
        const message = fallback.error?.message || error?.message || 'Content not found'
        return NextResponse.json({ success: false, error: message }, { status: 404 })
      }

      data = fallback.data
      actualTable = fallbackTable
    }

    // Normalize source URL key for UI.
    const normalized = {
      ...(data || {}),
      canonical_url: (data as any)?.canonical_url || (data as any)?.published_url || null,
    }

    return NextResponse.json({
      success: true,
      actualTable,
      item: normalized,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}
