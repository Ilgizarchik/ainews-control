'use client'

import { useEffect, useMemo, useState } from 'react'
import { ContentBoard } from '@/components/content/ContentBoard'
import { ContentItem, ContentFilter, ContentStats } from '@/types/content'
import { LoadingDots } from '@/components/ui/loading-dots'
import { createClient } from '@/lib/supabase/client'
import { getContentStats } from '@/app/actions/content-actions'

const PAGE_SIZE = 50

// ... imports

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [stats, setStats] = useState<ContentStats>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentFilter, setCurrentFilter] = useState<ContentFilter>('pending')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  const buildQuery = (filter: ContentFilter, sources: string[]) => {
    let query = (supabase.from('news_items' as any) as any).select('*', { count: 'exact' })

    if (filter === 'pending') {
      query = query.eq('gate1_decision', 'send').is('approve1_decision', null)
    } else if (filter === 'approved') {
      query = query.eq('approve1_decision', 'approved')
    } else if (filter === 'rejected') {
      query = query.eq('approve1_decision', 'rejected')
    } else {
      query = query.neq('gate1_decision', null)
    }

    if (sources.length > 0) {
      query = query.in('source_name', sources)
    }

    return query
  }

  const fetchPage = async (filter: ContentFilter, sources: string[], pageIndex: number) => {
    const from = pageIndex * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error, count } = await buildQuery(filter, sources)
      .order('created_at', { ascending: false }) // Use creation time as primary to show newest first in queue
      .order('published_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('[ContentPage] fetchPage error:', error)
      return { data: [] as ContentItem[], count: 0 }
    }

    return { data: (data || []) as ContentItem[], count: count || 0 }
  }

  const loadData = async (filter: ContentFilter, sources: string[], isInitial: boolean) => {
    if (isInitial) setLoading(true)
    else setRefreshing(true)

    try {
      // Parallel fetch but with individual error handling or fallback
      const [pageResults, statsResults] = await Promise.allSettled([
        fetchPage(filter, sources, 0),
        getContentStats(),
      ])

      if (pageResults.status === 'fulfilled') {
        const { data: itemsData, count } = pageResults.value
        setItems(itemsData)
        setTotalCount(count)
        setPage(0)
      } else {
        console.error('[ContentPage] Failed to fetch items:', pageResults.reason)
      }

      if (statsResults.status === 'fulfilled') {
        setStats(statsResults.value)
      } else {
        console.error('[ContentPage] Failed to fetch stats:', statsResults.reason)
      }

    } catch (error) {
      console.error('[ContentPage] Critical error in loadData:', error)
    } finally {
      if (isInitial) setLoading(false)
      setRefreshing(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const { data: moreItems } = await fetchPage(currentFilter, selectedSources, nextPage)
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id))
        const uniqueNewItems = moreItems.filter(i => !existingIds.has(i.id))
        return [...prev, ...uniqueNewItems]
      })
      setPage(nextPage)
    } catch (error) {
      console.error('Error loading more content:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    // Only use full screen loading for the very first mount
    loadData(currentFilter, selectedSources, loading)
  }, [currentFilter, selectedSources])

  const handleItemUpdated = async (id: string, outcome?: 'updated' | 'stale') => {
    // Optimistic remove for pending
    if (currentFilter === 'pending' && outcome) {
      setItems(prev => prev.filter(item => item.id !== id))
    }
    // Refresh stats and current page
    await loadData(currentFilter, selectedSources, false)
  }

  const handleFilterChange = (filter: ContentFilter) => {
    setCurrentFilter(filter)
    // We don't clear items here to avoid white flash
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
        <div className="relative p-10 rounded-3xl bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-white/20 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 animate-pulse" />
          <div className="relative z-10 space-y-8 text-center">
            <LoadingDots className="h-12" />
            <div className="space-y-2">
              <p className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                Синхронизация...
              </p>
              <p className="text-sm text-muted-foreground font-medium max-w-[200px] mx-auto opacity-70">
                Загружаем свежий контент из ваших источников
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const canLoadMore = items.length < totalCount

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <ContentBoard
        items={items}
        stats={stats}
        onFilterChange={handleFilterChange}
        currentFilter={currentFilter}
        totalCount={totalCount}
        onLoadMore={loadMore}
        canLoadMore={canLoadMore}
        loadingMore={loadingMore}
        onItemUpdated={handleItemUpdated}
        selectedSources={selectedSources}
        onSourcesChange={setSelectedSources}
        isRefreshing={refreshing}
      />
    </div>
  )
}
