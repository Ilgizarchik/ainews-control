"use client"

import { useState, useMemo, useEffect } from "react"
import { CustomCalendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import {
    CalendarDays,
    Clock,
    ListFilter,
    Check,
    Plus,
    MoreHorizontal,
    CheckCircle2,
    AlertCircle
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

import { useBoardJobs, JobWithNews } from "@/hooks/useBoardJobs"
import { TAG_COLORS, getTagColors } from "@/lib/tag-colors"
import { PLATFORM_CONFIG, getPlatformConfig } from "@/lib/platform-config"
import { SocialPostEditorDialog } from "./SocialPostEditorDialog"
import { NewsEditorDialog } from "./NewsEditorDialog"
import { cleanupDisabledPlatforms } from "@/app/actions/publish-actions"

const AVAILABLE_TAGS = Object.keys(TAG_COLORS)

export interface GroupedNews {
    id: string
    title: string
    type: 'news' | 'review'
    status: 'published' | 'error' | 'cancelled' | 'queued' | 'processing'
    publish_at: string
    created_at: string
    jobs: JobWithNews[]
    draft_image_file_id?: string | null
}

export function BoardView() {
    const { jobs, loading, error, fetchJobs, activePlatforms } = useBoardJobs()
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null])
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [sortBy, setSortBy] = useState<'publish_at' | 'created_at'>('publish_at')
    // Дефолтные фильтры: показываем "Запланировано" (queued) и "Частично" (processing)
    const [filterStatuses, setFilterStatuses] = useState<string[]>(['queued', 'processing'])

    useEffect(() => {
        const init = async () => {
            await fetchJobs()
            // Запускаем очистку старых задач для выключенных соцсетей
            try {
                const res = await cleanupDisabledPlatforms()
                if (res.success && typeof res.deletedCount === 'number' && res.deletedCount > 0) {
                    toast.info(`Очистка: удалено ${res.deletedCount} задач для выключенных соцсетей`)
                    fetchJobs()
                }
            } catch (e) {
                console.error('Cleanup failed', e)
            }
        }
        init()
    }, [fetchJobs])

    // Editor states
    const [editingJob, setEditingJob] = useState<JobWithNews | null>(null)
    const [editingContent, setEditingContent] = useState<{ id: string, type: 'news' | 'review' } | null>(null)
    const [datePickerOpen, setDatePickerOpen] = useState(false)

    // Calculate Grouped News
    const groupedNews = useMemo(() => {
        if (!jobs.length) return []

        // 1. Group by News ID
        const groups: Record<string, GroupedNews> = {}

        jobs.forEach(job => {
            // Filter by Date Range
            if (dateRange[0]) {
                // @ts-ignore
                const jobDate = new Date(job.publish_at)
                if (jobDate < dateRange[0]) return
            }
            if (dateRange[1]) {
                // @ts-ignore
                const jobDate = new Date(job.publish_at)
                const endOfDay = new Date(dateRange[1])
                endOfDay.setHours(23, 59, 59, 999)
                if (jobDate > endOfDay) return
            }

            // Filter by Tags
            if (selectedTags.length > 0) {
                const jobTags = job.news_items?.gate1_tags || []
                if (!jobTags.some(t => selectedTags.includes(t))) return
            }

            const itemId = job.news_id || job.review_id
            if (!itemId) return

            if (!groups[itemId]) {
                const title = job.news_items?.draft_title
                    || job.news_items?.title
                    || job.review_items?.draft_title
                    || job.review_items?.title_seed
                    || 'Без названия'

                const draftImage = job.news_items?.draft_image_file_id || job.review_items?.draft_image_file_id

                groups[itemId] = {
                    id: itemId,
                    title: title,
                    type: job.news_id ? 'news' : 'review',
                    status: 'queued',
                    // @ts-ignore
                    publish_at: job.publish_at,
                    // Используем самую раннюю дату создания из всех задач или дату создания текущей задачи
                    created_at: job.created_at || '',
                    jobs: [],
                    draft_image_file_id: draftImage
                }
            }
            // Обновляем created_at если текущая задача создана раньше (на всякий случай)
            if (new Date(job.created_at || '') < new Date(groups[itemId].created_at)) {
                groups[itemId].created_at = job.created_at || ''
            }
            groups[itemId].jobs.push(job)
        })

        // 2. Determine Group Status and apply Status Filter
        let result = Object.values(groups).map(group => {
            const statuses = new Set(group.jobs.map(j => j.status))

            // Определяем статус группы на основе реальных job_status из БД
            if (statuses.has('error') || statuses.has('failed')) {
                group.status = 'error'
            } else if (statuses.has('published') && statuses.size === 1) {
                group.status = 'published'
            } else if (statuses.has('published')) {
                // Частично опубликовано (есть published + другие статусы)
                group.status = 'processing'
            } else if (statuses.has('cancelled') && statuses.size === 1) {
                group.status = 'cancelled'
            } else if (statuses.has('processing')) {
                group.status = 'processing'
            } else if (statuses.has('queued')) {
                group.status = 'queued'
            } else {
                // Fallback для любых других случаев
                group.status = 'queued'
            }

            return group
        })

        if (filterStatuses.length > 0) {
            result = result.filter(g => filterStatuses.includes(g.status))
        }

        // 3. Sort
        result.sort((a, b) => {
            if (sortBy === 'created_at') {
                const dateA = new Date(a.created_at).getTime()
                const dateB = new Date(b.created_at).getTime()
                // Создано: от новых к старым (Descending)
                return dateB - dateA
            }
            // По дате публикации: от ранних к поздним (Ascending) - "по порядку"
            const dateA = new Date(a.publish_at).getTime()
            const dateB = new Date(b.publish_at).getTime()
            return dateA - dateB
        })

        return result
    }, [jobs, dateRange, selectedTags, filterStatuses, sortBy])

    const handleAddJob = (id: string, type: 'news' | 'review', platform: string) => {
        toast.info("Функционал в разработке: Создание поста для " + platform)
    }

    if (loading && !jobs.length) {
        return <BoardSkeleton />
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Ошибка загрузки</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-1 mb-4">
                    {error}
                </p>
                <Button onClick={() => fetchJobs()} variant="outline">
                    Попробовать снова
                </Button>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="sticky top-0 z-50 px-4 sm:px-6 py-4 bg-card border-b">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold tracking-tight shrink-0">Очередь публикаций</h2>

                    <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 scrollbar-none -mx-4 px-4 xl:mx-0 xl:px-0">
                        {/* Tags Filter */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={cn(
                                    "flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-all shadow-sm whitespace-nowrap",
                                    selectedTags.length > 0
                                        ? "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                                        : "bg-card border-border text-foreground hover:bg-accent hover:border-accent-foreground/30"
                                )}>
                                    <svg className="w-4 h-4 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                    <span>Теги</span>
                                    {selectedTags.length > 0 && (
                                        <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                                            {selectedTags.length}
                                        </span>
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0 overflow-hidden" align="start">
                                <div className="px-4 py-3 border-b bg-gradient-to-r from-muted/50 to-muted/30">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                        Фильтр по тегам
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {selectedTags.length > 0 ? `${selectedTags.length} выбрано` : 'Выберите теги'}
                                    </p>
                                </div>
                                <div className="p-2 max-h-[400px] overflow-y-auto">
                                    <div className="space-y-1">
                                        {AVAILABLE_TAGS.map(tag => {
                                            const isSelected = selectedTags.includes(tag)
                                            const colors = getTagColors(tag)
                                            return (
                                                <label
                                                    key={tag}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 group",
                                                        isSelected
                                                            ? cn("shadow-sm border-2", colors.bg, "border-current")
                                                            : "hover:bg-muted border-2 border-transparent"
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-input w-4 h-4 cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedTags(prev => [...prev, tag])
                                                            } else {
                                                                setSelectedTags(prev => prev.filter(t => t !== tag))
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <svg className={cn("w-3.5 h-3.5", colors.icon, !isSelected && "opacity-50")} fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className={cn(
                                                            "capitalize text-sm font-medium",
                                                            colors.text,
                                                            !isSelected && "opacity-60"
                                                        )}>
                                                            {tag}
                                                        </span>
                                                    </div>
                                                    {isSelected && (
                                                        <Check className={cn("w-4 h-4", colors.icon)} strokeWidth={3} />
                                                    )}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                                {selectedTags.length > 0 && (
                                    <div className="p-3 border-t bg-muted/30">
                                        <button
                                            onClick={() => setSelectedTags([])}
                                            className="w-full text-sm text-muted-foreground hover:text-foreground font-medium py-2 px-3 rounded-md hover:bg-background transition-colors"
                                        >
                                            Сбросить фильтры
                                        </button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>

                        {/* Status Filter */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    className={cn(
                                        "flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-all shadow-sm whitespace-nowrap",
                                        filterStatuses.length > 0 && filterStatuses.length < 5
                                            ? "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                                            : "bg-card border-border text-foreground hover:bg-accent hover:border-accent-foreground/30"
                                    )}
                                >
                                    <ListFilter className="w-4 h-4 opacity-70" />
                                    <span>Статус</span>
                                    {filterStatuses.length > 0 && filterStatuses.length < 5 && (
                                        <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                                            {filterStatuses.length}
                                        </span>
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1">
                                    {[
                                        { id: 'queued', label: 'Запланировано', color: 'text-blue-600' },
                                        { id: 'processing', label: 'Частично', color: 'text-amber-600' },
                                        { id: 'published', label: 'Опубликовано', color: 'text-emerald-600' },
                                        { id: 'error', label: 'Ошибки', color: 'text-red-600' },
                                        { id: 'cancelled', label: 'Отменено', color: 'text-gray-500' },
                                    ].map((status) => {
                                        const isSelected = filterStatuses.includes(status.id)
                                        return (
                                            <div key={status.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md cursor-pointer"
                                                onClick={() => {
                                                    setFilterStatuses(prev =>
                                                        prev.includes(status.id)
                                                            ? prev.filter(p => p !== status.id)
                                                            : [...prev, status.id]
                                                    )
                                                }}
                                            >
                                                <div className={cn(
                                                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                                                )}>
                                                    {isSelected && <Check className="w-3 h-3" />}
                                                </div>
                                                <span className={cn("text-sm font-medium", status.color)}>{status.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <div className="h-6 w-[1px] bg-border/60 mx-1 flex-shrink-0" />

                        {/* Sort Options */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSortBy('publish_at')}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-all shadow-sm whitespace-nowrap",
                                    sortBy === 'publish_at'
                                        ? "bg-muted border-foreground/20 text-foreground"
                                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-accent-foreground/30"
                                )}
                            >
                                <Clock className={cn("w-4 h-4", sortBy === 'publish_at' ? "text-foreground" : "opacity-70")} />
                                По дате
                            </button>

                            <button
                                onClick={() => setSortBy('created_at')}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-all shadow-sm whitespace-nowrap",
                                    sortBy === 'created_at'
                                        ? "bg-muted border-foreground/20 text-foreground"
                                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-accent-foreground/30"
                                )}
                            >
                                <CalendarDays className={cn("w-4 h-4", sortBy === 'created_at' ? "text-foreground" : "opacity-70")} />
                                Создано
                            </button>
                        </div>

                        <div className="h-6 w-[1px] bg-border/60 mx-1 flex-shrink-0" />

                        {/* Date Picker - Compact */}
                        <div className="flex-1 min-w-[200px] xl:w-auto xl:flex-none">
                            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-card hover:bg-accent",
                                            !dateRange && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarDays className="mr-2 h-4 w-4 opacity-70" />
                                        {dateRange[0] ? (
                                            dateRange[1] ? (
                                                <span className="truncate">
                                                    {format(dateRange[0], "d MMM", { locale: ru })} - {format(dateRange[1], "d MMM", { locale: ru })}
                                                </span>
                                            ) : (
                                                <span>{format(dateRange[0], "dd LLL y", { locale: ru })}</span>
                                            )
                                        ) : (
                                            <span>Период</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <CalendarComponent
                                        value={dateRange}
                                        onChange={(value) => {
                                            if (Array.isArray(value)) {
                                                setDateRange(value as [Date | null, Date | null])
                                                // Закрываем календарь если выбраны обе даты
                                                if (value[0] && value[1]) {
                                                    setTimeout(() => setDatePickerOpen(false), 300)
                                                }
                                            }
                                        }}
                                        selectRange={true}
                                    />
                                    {(dateRange[0] || dateRange[1]) && (
                                        <div className="p-2 border-t bg-muted/20">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full text-muted-foreground hover:text-foreground h-8 text-xs"
                                                onClick={() => {
                                                    setDateRange([null, null])
                                                    setDatePickerOpen(false)
                                                }}
                                            >
                                                Сбросить период
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
                    {groupedNews.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-xl bg-card/30">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <CalendarDays className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">Нет запланированных постов</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mt-1">
                                Очередь пуста. Создайте новый пост, чтобы начать.
                            </p>
                        </div>
                    )}

                    {groupedNews.map(group => (
                        <NewsGroupCard
                            key={group.id}
                            group={group}
                            activePlatforms={activePlatforms}
                            onEdit={(job) => setEditingJob(job)}
                            onOpenEditor={() => setEditingContent({ id: group.id, type: group.type })}
                            onAddJob={handleAddJob}
                        />
                    ))}

                    {editingJob && (
                        <SocialPostEditorDialog
                            job={editingJob}
                            isOpen={!!editingJob}
                            onClose={() => setEditingJob(null)}
                            onUpdate={fetchJobs}
                        />
                    )}

                    {editingContent && (
                        <NewsEditorDialog
                            contentId={editingContent.id}
                            contentType={editingContent.type}
                            isOpen={!!editingContent}
                            onClose={() => setEditingContent(null)}
                            onSaved={() => {
                                fetchJobs()
                            }}
                        />
                    )}
                </div>
            </div>
        </div >
    )
}

function BoardSkeleton() {
    return (
        <div className="p-6 space-y-6 h-full overflow-hidden">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-9 w-64" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-32 rounded-xl border border-border/50 bg-card p-5 space-y-4">
                        <Skeleton className="h-6 w-3/4" />
                        <div className="flex gap-2 pt-4">
                            <Skeleton className="h-6 w-16 rounded-md" />
                            <Skeleton className="h-6 w-16 rounded-md" />
                            <Skeleton className="h-6 w-16 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function NewsGroupCard({ group, activePlatforms, onEdit, onOpenEditor, onAddJob }: {
    group: GroupedNews,
    activePlatforms: string[],
    onEdit: (j: JobWithNews) => void,
    onOpenEditor: () => void
    onAddJob: (id: string, type: 'news' | 'review', platform: string) => void
}) {
    // @ts-ignore
    const sortedJobs = [...group.jobs].sort((a, b) => {
        if (a.platform === 'site' && b.platform !== 'site') return -1
        if (a.platform !== 'site' && b.platform === 'site') return 1
        // @ts-ignore
        return new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime()
    })

    // @ts-ignore
    const usedPlatforms = new Set(group.jobs.map(j => j.platform.toLowerCase()))
    const availablePlatforms = Object.keys(PLATFORM_CONFIG).filter(p => {
        const isNotUsed = !usedPlatforms.has(p)
        const isActive = activePlatforms.includes(p)
        return isNotUsed && isActive
    })

    const statusConfig = {
        published: {
            border: 'border-l-emerald-500',
            bg: 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent'
        },
        error: {
            border: 'border-l-red-500',
            bg: 'bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent'
        },
        queued: {
            border: 'border-l-blue-500',
            bg: 'bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent'
        },
        processing: {
            border: 'border-l-amber-500',
            bg: 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent'
        },
        cancelled: {
            border: 'border-l-gray-400',
            bg: 'bg-gradient-to-r from-gray-200/50 via-gray-100/50 to-transparent dark:from-gray-800/30'
        }
    }[group.status]

    return (
        <div
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button')) return;
                onOpenEditor();
            }}
            className={cn(
                "bg-card border border-border/60 rounded-xl overflow-hidden flex flex-col transition-all duration-300 group h-full relative cursor-pointer",
                "hover:shadow-xl hover:-translate-y-2 hover:border-border",
                "border-l-[6px]",
                statusConfig.border
            )}
        >
            {/* Image Preview */}
            {group.draft_image_file_id && (
                <div className="relative w-full h-40 overflow-hidden shrink-0 bg-card">
                    <img
                        src={`/api/telegram/photo/${group.draft_image_file_id}`}
                        alt=""
                        className="absolute inset-[-1px] w-[calc(100%+2px)] h-[calc(100%+2px)] object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {/* Solid bottom gradient to perfectly blend with the card background */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/90 to-transparent z-10" />
                </div>
            )}

            {/* Content Container */}
            <div className="p-5 flex flex-col gap-4 flex-1 relative z-20 bg-card -mt-1">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-base leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                        {group.title}
                    </h3>
                </div>

                <div className="relative mt-auto pt-2 flex flex-wrap items-center gap-2.5">
                    {sortedJobs.map(job => (
                        <PlatformTimeChip key={job.id} job={job} onClick={() => onEdit(job)} />
                    ))}

                    {/* Add Platform Button */}
                    {availablePlatforms.length > 0 && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="group relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-110 active:scale-95">
                                    <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300" />
                                    <Plus className="relative w-4 h-4 text-white stroke-[2.5]" />
                                    <div className="absolute inset-0 rounded-full border-2 border-emerald-400 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="start">
                                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                                    Добавить публикацию
                                </div>
                                {availablePlatforms.map(platform => {
                                    const config = getPlatformConfig(platform)
                                    const Icon = config.icon
                                    return (
                                        <button
                                            key={platform}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onAddJob(group.id, group.type, platform)
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-left transition-colors"
                                        >
                                            <Icon className={cn("w-4 h-4", config.color)} />
                                            <span>{config.label}</span>
                                        </button>
                                    )
                                })}
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </div>
        </div>
    )
}

function PlatformTimeChip({ job, onClick }: { job: JobWithNews, onClick: () => void }) {
    const config = getPlatformConfig(job.platform || 'site')
    const { icon: Icon, color, label, bgColor, borderColor } = config

    const isPublished = job.status === 'published'
    const isError = job.status === 'error'
    // @ts-ignore
    const date = new Date(job.publish_at)
    const now = new Date()
    const isCurrentYear = date.getFullYear() === now.getFullYear()
    const timeStr = format(date, isCurrentYear ? 'd MMM, HH:mm' : 'd MMM yyyy, HH:mm', { locale: ru })

    let containerStyle = cn(
        "border-2 bg-gradient-to-br text-foreground shadow-sm hover:shadow-md",
        borderColor,
        bgColor
    )
    let iconStyle = color
    let textStyle = "text-foreground font-medium"

    if (isPublished) {
        containerStyle = cn(
            "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20",
            "border-2 border-emerald-300 dark:border-emerald-700",
            "shadow-emerald-200/50 dark:shadow-emerald-900/30"
        )
        iconStyle = "text-emerald-600 dark:text-emerald-400"
        textStyle = "text-emerald-700 dark:text-emerald-300 font-semibold"
    } else if (isError) {
        containerStyle = cn(
            "bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20",
            "border-2 border-red-300 dark:border-red-700",
            "shadow-red-200/50 dark:shadow-red-900/30"
        )
        iconStyle = "text-red-600 dark:text-red-400"
        textStyle = "text-red-700 dark:text-red-300 font-semibold"
    }

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={onClick}
                        className={cn(
                            "flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg text-xs transition-all active:scale-95 group/chip",
                            "hover:scale-105 hover:-translate-y-0.5",
                            containerStyle
                        )}
                    >
                        <Icon className={cn("w-4 h-4", iconStyle)} />
                        <span className={cn("font-mono tracking-tight whitespace-nowrap", textStyle)}>
                            {timeStr}
                        </span>
                        {isPublished && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ml-0.5" />}
                        {isError && <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 ml-0.5" />}
                        {!isPublished && !isError && (
                            <div className="pl-1.5 border-l-2 border-border/50 ml-0.5">
                                <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/chip:text-foreground transition-colors" />
                            </div>
                        )}
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                    <p>Изменить время для <b>{label}</b></p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
