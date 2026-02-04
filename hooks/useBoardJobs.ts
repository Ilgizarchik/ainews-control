import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { toast } from 'sonner'

export type JobWithNews = Database['public']['Tables']['publish_jobs']['Row'] & {
  news_items: Database['public']['Tables']['news_items']['Row'] | null
  review_items: Database['public']['Tables']['review_items']['Row'] | null
}

export function useBoardJobs() {
  const [jobs, setJobs] = useState<JobWithNews[]>([])
  const [loading, setLoading] = useState(false)
  const [mainPlatform, setMainPlatform] = useState<string>('site')
  const [activePlatforms, setActivePlatforms] = useState<string[]>(['site'])

  const supabase = useMemo(() => {
    return createClient()
  }, [])

  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch ALL active recipes to filter the plus menu
      const { data: recipes } = await supabase
        .from('publish_recipes')
        .select('platform, is_main')
        .eq('is_active', true)

      if (recipes) {
        const platforms = recipes.map((r: any) => r.platform.toLowerCase())
        if (!platforms.includes('site')) platforms.push('site')
        setActivePlatforms(platforms)

        const main = (recipes as any[]).find((r: any) => r.is_main)?.platform
        if (main) setMainPlatform(main)
      }
    } catch (e) {
      console.warn('[useBoardJobs] Failed to fetch active platforms:', e)
    }

    const { data, error: fetchError } = await supabase
      .from('publish_jobs')
      .select(`
        *,
        news_items (
          id, title, draft_title, draft_image_file_id, canonical_url, image_url, gate1_tags,
          draft_announce, draft_longread, draft_longread_site,
          draft_announce_tg, draft_announce_vk, draft_announce_ok, 
          draft_announce_fb, draft_announce_x, draft_announce_threads
        ),
        review_items (
          id, title_seed, draft_title, draft_image_file_id,
          draft_announce, draft_longread, draft_longread_site,
          draft_announce_tg, draft_announce_vk, draft_announce_ok, 
          draft_announce_fb, draft_announce_x, draft_announce_threads
        )
      `)
      .order('publish_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message || 'Ошибка загрузки данных')
      toast.error(`Не удалось загрузить задачи: ${fetchError.message}`)
    } else {
      setJobs(data as JobWithNews[])
    }
    setLoading(false)
  }, [supabase])

  const updateJobTime = async (jobId: string, newDate: Date) => {
    const { error } = await supabase
      .from('publish_jobs')
      .update({ publish_at: newDate.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', jobId)
    if (error) throw error
    await fetchJobs()
  }

  return { jobs, loading, error, fetchJobs, updateJobTime, mainPlatform, activePlatforms }
}
