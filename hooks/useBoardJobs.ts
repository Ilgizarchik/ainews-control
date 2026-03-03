import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { toast } from 'sonner'

type BoardJobRow = Pick<Database['public']['Tables']['publish_jobs']['Row'],
  'id' | 'news_id' | 'review_id' | 'platform' | 'status' | 'publish_at' | 'created_at' | 'updated_at' |
  'social_content' | 'published_url' | 'retry_count' | 'error_message' | 'external_id' | 'published_at_actual'
>

type BoardNewsItem = Pick<Database['public']['Tables']['news_items']['Row'],
  'id' | 'title' | 'draft_title' | 'draft_image_file_id' | 'gate1_tags' | 'draft_longread_site' |
  'draft_announce_tg' | 'draft_announce_vk' | 'draft_announce_ok' | 'draft_announce_fb' | 'draft_announce_x' | 'draft_announce_threads'
>

type BoardReviewItem = Pick<Database['public']['Tables']['review_items']['Row'],
  'id' | 'title_seed' | 'draft_title' | 'draft_image_file_id' | 'draft_longread_site' |
  'draft_announce_tg' | 'draft_announce_vk' | 'draft_announce_ok' | 'draft_announce_fb' | 'draft_announce_x' | 'draft_announce_threads'
>

type RawBoardJob = BoardJobRow & {
  news_items: BoardNewsItem[] | BoardNewsItem | null
  review_items: BoardReviewItem[] | BoardReviewItem | null
}

const normalizeRelation = <T>(value: T[] | T | null): T | null => {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export type JobWithNews = BoardJobRow & {
  news_items: BoardNewsItem | null
  review_items: BoardReviewItem | null
}

export function useBoardJobs() {
  const [jobs, setJobs] = useState<JobWithNews[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [mainPlatform, setMainPlatform] = useState<string>('site')
  const [activePlatforms, setActivePlatforms] = useState<string[]>(['site'])

  const supabase = useMemo(() => {
    return createClient()
  }, [])

  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      // Recipes and jobs are independent; fetch in parallel to reduce page load latency.
      const [recipesResult, jobsResult] = await Promise.all([
        supabase
          .from('publish_recipes')
          .select('platform, is_main')
          .eq('is_active', true),
        supabase
          .from('publish_jobs')
          .select(`
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
          `)
          .order('publish_at', { ascending: true }),
      ])

      if (recipesResult.error) {
        console.warn('[useBoardJobs] Failed to fetch active platforms:', recipesResult.error)
      } else if (recipesResult.data) {
        const platforms = recipesResult.data.map((r: any) => r.platform.toLowerCase())
        if (!platforms.includes('site')) platforms.push('site')
        setActivePlatforms(platforms)

        const main = (recipesResult.data as any[]).find((r: any) => r.is_main)?.platform
        if (main) setMainPlatform(main)
      }

      if (jobsResult.error) {
        setError(jobsResult.error.message || 'Ошибка загрузки данных')
        toast.error(`Не удалось загрузить задачи: ${jobsResult.error.message}`)
      } else {
        const normalizedJobs = ((jobsResult.data || []) as RawBoardJob[]).map((job) => ({
          ...job,
          news_items: normalizeRelation(job.news_items),
          review_items: normalizeRelation(job.review_items),
        }))
        setJobs(normalizedJobs)
      }
    } catch (e: any) {
      const msg = e?.message || 'Ошибка загрузки данных'
      setError(msg)
      toast.error(`Не удалось загрузить задачи: ${msg}`)
    }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  const updateJobOptimistically = useCallback((jobId: string, newDate: Date) => {
    setJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, publish_at: newDate.toISOString(), updated_at: new Date().toISOString() } as JobWithNews : job
    ))
  }, [])

  const updateJobTime = async (jobId: string, newDate: Date) => {
    const { error } = await supabase
      .from('publish_jobs')
      .update({ publish_at: newDate.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', jobId)
    if (error) throw error
    // fetchJobs запустится в фоне, так как jobs.length > 0
    await fetchJobs()
  }

  const cancelJobOptimistically = useCallback((jobId: string) => {
    setJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, status: 'cancelled' } as JobWithNews : job
    ))
  }, [])

  const removeNewsOptimistically = useCallback((contentId: string) => {
    setJobs(prev => prev.filter(job =>
      job.news_id !== contentId && job.review_id !== contentId
    ))
  }, [])

  return {
    jobs,
    setJobs,
    loading,
    refreshing,
    error,
    fetchJobs,
    updateJobTime,
    updateJobOptimistically,
    cancelJobOptimistically,
    removeNewsOptimistically,
    mainPlatform,
    activePlatforms
  }
}
