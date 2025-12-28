import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type JobWithNews = Database['public']['Tables']['publish_jobs']['Row'] & {
  news_items: {
    title: string
    canonical_url: string
    image_url: string | null
  } | null
}

export function useCalendarJobs() {
  const [jobs, setJobs] = useState<JobWithNews[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const fetchJobs = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('publish_jobs')
      .select(`*, news_items (title, canonical_url, image_url)`)
      .gte('publish_at', start.toISOString())
      .lt('publish_at', end.toISOString())

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
      }
      return Promise.resolve({ error: 'Invalid params' })
    })
    const results = await Promise.all(promises)
    const errors = results.filter(r => r.error)
    if (errors.length > 0) throw new Error(`Failed updates: ${errors.length}`)
  }

  return { jobs, loading, fetchJobs, updateJobTime, updateBatchJobs }
}
