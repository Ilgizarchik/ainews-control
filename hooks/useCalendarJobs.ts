import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { toast } from 'sonner'

type JobWithNews = Database['public']['Tables']['publish_jobs']['Row'] & {
  review_id?: string | null // Временно добавлено вручную до регенерации типов
  news_items: {
    title: string
    draft_title: string | null
    canonical_url: string
    image_url: string | null
  } | null
  review_items: {
    title_seed: string | null
    draft_title: string | null
  } | null
}

export function useCalendarJobs() {
  const [jobs, setJobs] = useState<JobWithNews[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const fetchJobs = useCallback(async (start: Date, end: Date, isInitial: boolean = false) => {
    if (isInitial) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from('publish_jobs')
      .select(`
        *,
        news_items (title, draft_title, canonical_url, image_url),
        review_items (title_seed, draft_title)
      `)
      .gte('publish_at', start.toISOString())
      .lt('publish_at', end.toISOString())

    if (error) {
      console.error('Error fetching jobs:', error)
      toast.error(`Не удалось загрузить задачи публикации: ${(error as any).message || 'Ошибка'}`)
    } else {
      setJobs(data as JobWithNews[])
    }
    setLoading(false)
    setRefreshing(false)
  }, [supabase])

  const updateJobOptimistically = useCallback((jobId: string, newDate: Date) => {
    setJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, publish_at: newDate.toISOString(), updated_at: new Date().toISOString() } as JobWithNews : job
    ))
  }, [])

  const updateJobTime = async (jobId: string, newDate: Date) => {
    const { error } = await supabase
      .from('publish_jobs')
      .update({
        publish_at: newDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
    if (error) throw error
  }

  const updateBatchJobs = async (updates: any[]) => {
    const promises = updates.map(u => {
      if (u.id) {
        return supabase
          .from('publish_jobs')
          .update({ publish_at: u.publish_at, updated_at: new Date().toISOString() })
          .eq('id', u.id)
      } else if (u.news_id && u.platform) {
        return supabase
          .from('publish_jobs')
          .update({ publish_at: u.publish_at, updated_at: new Date().toISOString() })
          .eq('news_id', u.news_id)
          .eq('platform', u.platform)
      } else if (u.review_id && u.platform) {
        return supabase
          .from('publish_jobs')
          .update({ publish_at: u.publish_at, updated_at: new Date().toISOString() })
          .eq('review_id', u.review_id)
          .eq('platform', u.platform)
      }
      return Promise.resolve({ error: 'Invalid params' })
    })
    const results = await Promise.all(promises)
    const errors = results.filter(r => r.error)
    if (errors.length > 0) throw new Error(`Failed updates: ${errors.length}`)
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
    fetchJobs,
    updateJobTime,
    updateBatchJobs,
    cancelJobOptimistically,
    removeNewsOptimistically,
    updateJobOptimistically
  }
}
