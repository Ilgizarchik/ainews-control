import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const PUBLICATIONS_CACHE_TAGS = {
  jobs: 'publications-jobs',
  board: 'publications-board',
  calendar: 'publications-calendar',
  recipes: 'publications-recipes',
} as const

export async function getBoardJobsRaw() {
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

  if (recipesResult.error) throw recipesResult.error
  if (jobsResult.error) throw jobsResult.error

  return {
    recipes: recipesResult.data || [],
    jobs: jobsResult.data || [],
  }
}

export async function getCalendarJobsRaw(start: string, end: string) {
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

  if (error) throw error
  return data || []
}

const getBoardJobsCachedInternal = unstable_cache(getBoardJobsRaw, ['publications-board-jobs-v1'], {
  revalidate: 5,
  tags: [
    PUBLICATIONS_CACHE_TAGS.jobs,
    PUBLICATIONS_CACHE_TAGS.board,
    PUBLICATIONS_CACHE_TAGS.recipes,
  ],
})

const getCalendarJobsCachedInternal = unstable_cache(
  async (start: string, end: string) => getCalendarJobsRaw(start, end),
  ['publications-calendar-jobs-v1'],
  {
    revalidate: 10,
    tags: [PUBLICATIONS_CACHE_TAGS.jobs, PUBLICATIONS_CACHE_TAGS.calendar],
  }
)

export async function getBoardJobsCached() {
  return getBoardJobsCachedInternal()
}

export async function getCalendarJobsCached(start: string, end: string) {
  return getCalendarJobsCachedInternal(start, end)
}

