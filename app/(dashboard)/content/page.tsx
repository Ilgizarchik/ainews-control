'use client'

import { useEffect, useMemo, useState } from 'react'
import { ContentItem, ContentFilter, ContentStats } from '@/types/content'
import { ContentBoard, ContentSortOption } from '@/components/content/ContentBoard'
import { LoadingDots } from '@/components/ui/loading-dots'
import { createClient } from '@/lib/supabase/client'
import { getContentStats, fetchContentItems } from '@/app/actions/content-actions'
import { toast } from 'sonner'

const PAGE_SIZE = 51

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
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  const fetchPage = async (filter: ContentFilter, sources: string[], pageIndex: number, sort: ContentSortOption, search: string) => {
    // Server Action call
    const result = await fetchContentItems(filter, sources, pageIndex, PAGE_SIZE, sort as any, search)

    if (result.error) {
      console.error('[ContentPage] Server Action Error:', result.error)
      throw new Error(result.error.message || 'Server Action Failed')
    }

    return { data: (result.data || []) as ContentItem[], count: result.count || 0 }
  }

  const loadData = async (filter: ContentFilter, sources: string[], search: string, isInitial: boolean) => {
    if (isInitial) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      // Parallel fetch but with individual error handling or fallback
      const [pageResults, statsResults] = await Promise.allSettled([
        fetchPage(filter, sources, 0, sortOption, search),
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
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const { data: moreItems } = await fetchPage(currentFilter, selectedSources, nextPage, sortOption, searchQuery)
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
    // Note: Search changes trigger this with a small debounce or immediately depending on UI
    loadData(currentFilter, selectedSources, searchQuery, loading)
  }, [currentFilter, selectedSources, sortOption, searchQuery])

  const handleItemUpdated = async (id: string, outcome?: 'updated' | 'stale') => {
    if (outcome === 'stale') {
      // If data is stale (e.g. undo action or error), we refresh the whole list
      await loadData(currentFilter, selectedSources, searchQuery, false)
      return
    }

    // 1. Optimistic removal from local UI list
    setItems(prev => prev.filter(item => item.id !== id))
    setTotalCount(prev => Math.max(0, prev - 1))

    // 2. Silently update stats in background without resetting the entire list
    try {
      const statsResult = await getContentStats()
      setStats(statsResult)
    } catch (e) {
      console.error('Stats refresh failed:', e)
    }
  }

  const handleFilterChange = (filter: ContentFilter) => {
    setCurrentFilter(filter)
    // We don't clear items here to avoid white flash
  }

  if (loading) {
    // ... existing loading UI
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isRefreshing={refreshing}
      />
    </div>
  )
}
