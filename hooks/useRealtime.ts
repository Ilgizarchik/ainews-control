import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtime(
  table: 'news_items' | 'publish_jobs' | 'system_prompts' | 'publish_recipes',
  callback: () => void,
  filter?: string
) {
  const supabase = createClient()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleUpdate = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        callback()
      }, 500)
    }

    const channelName = `realtime-${table}-${filter || 'all'}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        handleUpdate
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [table, filter, callback, supabase])
}
