'use client'

import { ContentItem, ContentFilter, ContentStats } from '@/types/content'
import { ContentCard } from './ContentCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Loader2, Calendar, Newspaper } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ListFilter, X, Check } from 'lucide-react'
import { getContentStatsBySource } from '@/app/actions/content-actions'
import { LoadingDots } from '@/components/ui/loading-dots'
import { TutorialButton } from '../tutorial/TutorialButton'
import { getModerationTutorialSteps } from '@/lib/tutorial/tutorial-config'

// ... imports

export type ContentSortOption = 'date-desc' | 'date-asc' | 'no-date'

interface ContentBoardProps {
    items: ContentItem[]
    stats: ContentStats
    onFilterChange: (filter: ContentFilter) => void
    currentFilter: ContentFilter
    totalCount: number
    onLoadMore: () => void
    canLoadMore: boolean
    loadingMore: boolean
    onItemUpdated: (id: string, outcome?: 'updated' | 'stale') => void
    selectedSources: string[]
    onSourcesChange: (sources: string[]) => void
    sortOption: ContentSortOption
    onSortChange: (sort: ContentSortOption) => void
    isRefreshing?: boolean
}

export function ContentBoard({
    items,
    stats,
    onFilterChange,
    currentFilter,
    totalCount,
    onLoadMore,
    canLoadMore,
    loadingMore,
    onItemUpdated,
    selectedSources,
    onSourcesChange,
    sortOption,
    onSortChange,
    isRefreshing = false,
}: ContentBoardProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [sourceStats, setSourceStats] = useState<{ source: string, count: number }[]>([])

    const moderationSteps = useMemo(() => getModerationTutorialSteps(onFilterChange), [onFilterChange])

    // Load available sources with counts from server (independent of pagination)
    useEffect(() => {
        let active = true
        getContentStatsBySource(currentFilter)
            .then(data => {
                if (active) setSourceStats(data)
            })
            .catch(err => {
                console.error('Failed to load source stats:', err)
            })
        return () => { active = false }
    }, [currentFilter])

    // Derive unique sources for rendering: use server stats if available
    const availableSources = useMemo(() => {
        // If we have server stats, use them as primary source list
        if (sourceStats.length > 0) return sourceStats

        // Fallback for immediate render (MVP) - though server stats should be fast
        const localSources = Array.from(new Set(items.map(i => i.source_name || 'unknown')))
            .sort((a, b) => a.localeCompare(b))
        return localSources.map(s => ({
            source: s,
            count: items.filter(i => (i.source_name || 'unknown') === s).length
        }))
    }, [sourceStats, items])

    const filteredItems = useMemo(() => {
        let result = items

        // 0. Source Filter is handled by Parent (Server Side), so we don't filter `result` here again 
        // unless we want to filter within the page, but that might be confusing if pagination is partial.
        // Actually, since parent reloads items based on filter, we trust `items` to be correct.

        // 1. Filter by Search (Client Side)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter(item => {
                return (
                    item.title?.toLowerCase().includes(query) ||
                    item.source_name?.toLowerCase().includes(query) ||
                    item.gate1_tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
                    item.gate1_reason?.toLowerCase().includes(query)
                )
            })
        }

        // 2. Sort is now handled by Parent (Server Side)
        return result
    }, [items, searchQuery])

    const filterButtons: Array<{ value: ContentFilter; label: string; count: number }> = [
        { value: 'pending', label: 'Ожидание', count: stats.pending },
        { value: 'all', label: 'Все', count: stats.total },
        { value: 'approved', label: 'Одобрено', count: stats.approved },
        { value: 'rejected', label: 'Отклонено', count: stats.rejected },
    ]

    return (
        <div className="space-y-6">
            {/* Premium Header with Gradient */}
            <div data-tutorial="moderation-hero" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-8 shadow-2xl">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4UzAgOC4wNiAwIDE4czguMDYgMTggMTggMTggMTgtOC4wNiAxOC0xOHptLTM2IDBjMC05Ljk0IDguMDYtMTggMTgtMThzMTggOC4wNiAxOCAxOC04LjA2IDE4LTE4IDE4UzAgMjcuOTQgMCAxOHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg flex items-center gap-4">
                                Контент на модерации
                            </h1>
                            <p className="text-white/90 mt-1 font-medium text-sm backdrop-blur-sm">
                                Одобряйте или отклоняйте новости, прошедшие AI-фильтр
                            </p>
                        </div>
                    </div>

                    <div className="absolute top-6 right-8">
                        <TutorialButton
                            label="Помощь"
                            steps={moderationSteps}
                            variant="secondary"
                            className="bg-white/20 hover:bg-white/30 text-white border-white/40 backdrop-blur-md"
                        />
                    </div>


                </div>
            </div>

            {/* Premium Filter Pills */}
            <div className="flex flex-col gap-4">
                <div data-tutorial="moderation-filters" className="flex items-center overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none gap-2 no-scrollbar">
                    {filterButtons.map((btn) => (
                        <Button
                            key={btn.value}
                            variant="outline"
                            size="sm"
                            onClick={() => onFilterChange(btn.value)}
                            className={cn(
                                'transition-all duration-300 rounded-full px-5 py-2.5 font-semibold border-2 whitespace-nowrap flex-shrink-0',
                                currentFilter === btn.value
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-transparent shadow-lg shadow-emerald-500/30 scale-105'
                                    : 'bg-background/60 backdrop-blur-sm hover:bg-accent hover:scale-105 hover:shadow-md'
                            )}
                        >
                            <span>{btn.label}</span>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "ml-2 px-2 py-0.5 text-xs font-black rounded-full",
                                    currentFilter === btn.value
                                        ? "bg-white/30 text-white border-white/50"
                                        : "bg-muted"
                                )}
                            >
                                {btn.count}
                            </Badge>
                        </Button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {/* Source Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button data-tutorial="moderation-sources" variant="outline" className="w-full sm:w-auto justify-between gap-2">
                                <span className="flex items-center gap-2">
                                    <ListFilter className="w-4 h-4" />
                                    {selectedSources.length === 0 ? 'Все источники' : `Источники (${selectedSources.length})`}
                                </span>
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 max-h-[400px] overflow-y-auto" align="end">
                            <DropdownMenuLabel>Фильтр источников</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {selectedSources.length > 0 && (
                                <>
                                    <div
                                        className="px-2 py-1.5 text-sm flex items-center gap-2 cursor-pointer hover:bg-muted rounded-md text-muted-foreground m-1 transition-colors"
                                        onClick={() => onSourcesChange([])}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Сбросить фильтры
                                    </div>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            {availableSources.map(({ source, count }) => {
                                const isSelected = selectedSources.includes(source)
                                const displayName = source === 'unknown' ? 'Не определен' : source
                                return (
                                    <div
                                        key={source}
                                        className="flex items-center justify-between px-2 py-2 text-sm cursor-pointer hover:bg-muted rounded-md m-1 transition-colors"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            onSourcesChange(isSelected
                                                ? selectedSources.filter(s => s !== source)
                                                : [...selectedSources, source]
                                            )
                                        }}
                                    >
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                                isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                                            )}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                            <span className="truncate max-w-[140px] font-medium">{displayName}</span>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 min-w-[24px] flex justify-center">
                                            {count}
                                        </Badge>
                                    </div>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sorting */}
                    <Select value={sortOption} onValueChange={(v) => onSortChange(v as ContentSortOption)}>
                        <SelectTrigger data-tutorial="moderation-sort" className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Сортировка" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date-desc">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>Сначала новые</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="date-asc">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>Сначала старые</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="no-date">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 opacity-50" />
                                    <span className="flex items-center gap-1.5">
                                        Без даты
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 leading-none border-dashed bg-muted/30">наверх</Badge>
                                    </span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <div data-tutorial="moderation-search" className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по названию, источнику..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative min-h-[400px]">
                {isRefreshing && filteredItems.length > 0 && (
                    <div className="absolute inset-x-0 top-0 flex justify-center z-50 pointer-events-none -mt-4">
                        <div className="flex items-center gap-3 bg-zinc-900/95 dark:bg-zinc-100/95 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-500 scale-90">
                            <LoadingDots dotClassName="w-1.5 h-1.5 bg-zinc-100 dark:bg-zinc-900" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 dark:text-zinc-900 opacity-90">
                                Обновляем ленту
                            </span>
                        </div>
                    </div>
                )}

                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center min-h-[400px]">
                        {isRefreshing ? (
                            <div className="space-y-6">
                                <LoadingDots className="h-12" />
                                <p className="text-muted-foreground font-semibold animate-pulse tracking-wide uppercase text-[11px]">
                                    ЗАГРУЗКА ДАННЫХ...
                                </p>
                            </div>
                        ) : (
                            <>
                                <Filter className="w-12 h-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Контент не найден</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    {searchQuery || selectedSources.length > 0
                                        ? 'Попробуйте изменить поисковый запрос или фильтры'
                                        : 'Нет контента для отображения в этой категории'}
                                </p>
                                {selectedSources.length > 0 && (
                                    <Button variant="link" onClick={() => onSourcesChange([])} className="mt-2 text-primary">
                                        Сбросить фильтры источников
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <div className={cn("transition-all duration-700 ease-in-out", isRefreshing && "opacity-50 blur-[2px] grayscale-[0.3] pointer-events-none")}>
                        <div data-tutorial="moderation-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {filteredItems.map((item) => (
                                <ContentCard key={item.id} item={item} onActionComplete={onItemUpdated} />
                            ))}
                        </div>

                        <div className="flex flex-col items-center gap-3 mt-12 pb-12">
                            <div className="text-sm text-muted-foreground text-center">
                                Показано {filteredItems.length} из {totalCount} элементов
                            </div>
                            {canLoadMore && !searchQuery.trim() && (
                                <Button
                                    variant="outline"
                                    onClick={onLoadMore}
                                    disabled={loadingMore}
                                    className="h-10 px-6 rounded-xl hover:bg-muted font-medium transition-all"
                                >
                                    {loadingMore ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Загрузка...
                                        </span>
                                    ) : (
                                        'Показать еще'
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
