'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import Link from 'next/link'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'

export default function ContentPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const supabase = createClient()
  const PAGE_SIZE = 30

  const loadingRef = useRef(false)

  const loadMore = async () => {
    if (loadingRef.current || !hasMore) return

    loadingRef.current = true
    setLoading(true)
    const from = data.length
    const to = from + PAGE_SIZE - 1

    try {
      const { data: newItems, error } = await supabase
        .from('news_items')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      if (newItems) {
        setData(prev => {
          const existingIds = new Set(prev.map(i => i.id))
          const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id))
          return [...prev, ...uniqueNewItems]
        })
        if (newItems.length < PAGE_SIZE) {
          setHasMore(false)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    const trigger = document.getElementById('scroll-trigger')
    if (trigger) observer.observe(trigger)

    return () => observer.disconnect()
  }, [data.length, hasMore])

  // Realtime updates (simplified: just refetch latest if list is empty, or maybe handle inserts?)
  // For now, let's keep it simple and disable full refetch on realtime to avoid resetting scroll
  // useRealtime('news_items', fetch) 

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h1 className="text-2xl font-bold text-foreground shrink-0">Content Feed</h1>
      <div className="border border-border rounded-md bg-card flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground border-b border-border sticky top-0 z-10">
              <tr><th className="p-4">Date</th><th className="p-4">Title</th><th className="p-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map(i => (
                <tr key={i.id} className="hover:bg-muted/50 transition-colors">
                  <td className="p-4 text-muted-foreground whitespace-nowrap w-[150px]">{format(new Date(i.created_at), 'MM/dd HH:mm')}</td>
                  <td className="p-4 text-foreground">{i.title}</td>
                  <td className="p-4 w-[100px]"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Loading trigger & indicator */}
          <div id="scroll-trigger" className="p-4 flex justify-center w-full">
            {loading && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>}
            {!hasMore && data.length > 0 && <span className="text-muted-foreground text-xs">No more items</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
