'use client'

import { useEffect, useMemo, useState } from 'react'
import { ContentItem, ContentFilter, ContentStats } from '@/types/content'
import { ContentBoard, ContentSortOption } from '@/components/content/ContentBoard'
import { LoadingDots } from '@/components/ui/loading-dots'
import { createClient } from '@/lib/supabase/client'
import { getContentStats } from '@/app/actions/content-actions'
import { toast } from 'sonner'

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
  const [sortOption, setSortOption] = useState<ContentSortOption>('date-desc')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  const buildQuery = (filter: ContentFilter, sources: string[]) => {
    // Optimized selection to avoid fetching heavy text/html columns
    const columns = [
      'id', 'title', 'source_name', 'canonical_url', 'published_at',
      'rss_summary', 'image_url',
      'gate1_decision', 'gate1_score', 'gate1_tags', 'gate1_reason', 'gate1_processed_at',
      'approve1_decision', 'approve1_decided_at', 'approve1_decided_by',
      'sent_to_approve1_at', 'approve1_message_id', 'approve1_chat_id',
      'status', 'is_viewed', 'created_at'
    ].join(',')

    let query = (supabase.from('news_items' as any) as any).select(columns, { count: 'exact' })

    if (filter === 'pending') {
      // Pending = Processed by AI (decision blocked OR send) but not processed by human yet
      query = query.neq('gate1_decision', null).is('approve1_decision', null)
    } else if (filter === 'approved') {
      query = query.eq('approve1_decision', 'approved')
    } else if (filter === 'rejected') {
      query = query.eq('approve1_decision', 'rejected')
    } else {
      // Show all items, including raw 'found' items that haven't passed Gate 1/AI yet
    }

    if (sources.length > 0) {
      query = query.in('source_name', sources)
    }

    return query
  }

  const fetchPage = async (filter: ContentFilter, sources: string[], pageIndex: number, sort: ContentSortOption) => {
    // Use Server Action instead of client-side RLS query for better performance/reliability
    const { fetchContentItems } = await import('@/app/actions/content-actions')

    // Convert sort option if needed, currently compatible
    const result = await fetchContentItems(filter, sources, pageIndex, PAGE_SIZE, sort as any)

    if (result.error) {
      console.error('[ContentPage] Server Action Error:', result.error)
      // Propagate error to trigger toast in loadData
      throw new Error(result.error.message || 'Server Action Failed')
    }

    return { data: (result.data || []) as ContentItem[], count: result.count || 0 }
  }

  const loadData = async (filter: ContentFilter, sources: string[], isInitial: boolean) => {
    if (isInitial) setLoading(true)
    else setRefreshing(true)

    try {
      // Parallel fetch but with individual error handling or fallback
      const [pageResults, statsResults] = await Promise.allSettled([
        fetchPage(filter, sources, 0, sortOption),
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

    } catch (error: any) {
      console.error('[ContentPage] Critical error in loadData:', error)
      // Check for Server Action ID mismatch (deployment update)
      if (error?.message?.includes('Server Action') && error?.message?.includes('not found')) {
        console.warn('Deployment mismatch dectected, reloading...')
        window.location.reload()
      }
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
      const { data: moreItems } = await fetchPage(currentFilter, selectedSources, nextPage, sortOption)
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
  }, [currentFilter, selectedSources, sortOption])

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
        sortOption={sortOption}
        onSortChange={setSortOption}
        isRefreshing={refreshing}
      />
    </div>
  )
}
