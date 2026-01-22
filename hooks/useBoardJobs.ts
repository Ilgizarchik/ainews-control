import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

export type JobWithNews = Database['public']['Tables']['publish_jobs']['Row'] & {
  news_items: {
    title: string
    draft_title: string | null
    canonical_url: string
    image_url: string | null
    gate1_tags: string[] | null
  } | null
}

export function useBoardJobs() {
  const [jobs, setJobs] = useState<JobWithNews[]>([])
  const [loading, setLoading] = useState(false)
  const [mainPlatform, setMainPlatform] = useState<string>('site')
  const supabase = useMemo(() => createClient(), [])

  const fetchJobs = useCallback(async () => {
    setLoading(true)

    // Fetch main platform
    const { data: mainRecipe } = await supabase
      .from('publish_recipes')
      .select('platform')
      .eq('is_main', true)
      .eq('is_active', true)
      .maybeSingle()

    if (mainRecipe) {
      setMainPlatform(mainRecipe.platform)
    }

    const { data, error } = await supabase
      .from('publish_jobs')
      .select(`*, news_items (title, draft_title, canonical_url, image_url, gate1_tags)`)
      .eq('status', 'queued')
      .order('publish_at', { ascending: true })

    if (error) console.error('Error fetching jobs:', error)
    else setJobs(data as JobWithNews[])
    setLoading(false)
  }, [supabase])

  const updateJobTime = async (jobId: string, newDate: Date) => {
    const { error } = await supabase
      .from('publish_jobs')
      .update({ publish_at: newDate.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', jobId)
    if (error) throw error
    await fetchJobs() // Refresh after update
  }

  return { jobs, loading, fetchJobs, updateJobTime, mainPlatform }
}
