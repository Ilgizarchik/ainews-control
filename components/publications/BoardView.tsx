'use client'

import { useState, useEffect, useMemo } from 'react'
import { useBoardJobs, JobWithNews } from '@/hooks/useBoardJobs'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
    CheckCircle2,
    AlertCircle,
    MoreHorizontal,
    Clock,
    CalendarDays,
    Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { getPlatformConfig } from '@/lib/platform-config'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NewsEditorDialog } from './NewsEditorDialog'
import { createClient } from '@/lib/supabase/client'

// --- TYPES ---
type GroupedNews = {
    newsId: string
    title: string
    minPublishAt: string
    minCreatedAt: string
    jobs: JobWithNews[]
    status: 'published' | 'error' | 'scheduled' | 'mixed'
}

export function BoardView() {
    const { jobs, loading, fetchJobs, updateJobTime, mainPlatform } = useBoardJobs()
    const [editingJob, setEditingJob] = useState<JobWithNews | null>(null)
    const [editingNewsId, setEditingNewsId] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<'publish_at' | 'created_at'>('publish_at')

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    })
    const [selectedTags, setSelectedTags] = useState<string[]>([])

    const AVAILABLE_TAGS = ["hunting", "weapons", "dogs", "recipes", "culture", "travel", "law", "events", "conservation", "other"]

    useEffect(() => {
        fetchJobs()
    }, [fetchJobs])

    const groupedNews = useMemo(() => {
        const groups: Record<string, GroupedNews> = {}
        jobs.forEach(job => {
            // --- FILTERING LOGIC ---
            // 1. Date Range Filter
            if (dateRange.from) {
                const jobDate = new Date(job.publish_at)
                if (jobDate < dateRange.from) return
            }
            if (dateRange.to) {
                const jobDate = new Date(job.publish_at)
                // Set end of day for 'to' date
                const endOfDay = new Date(dateRange.to)
                endOfDay.setHours(23, 59, 59, 999)
                if (jobDate > endOfDay) return
            }

            // 2. Tags Filter
            if (selectedTags.length > 0) {
                const jobTags = job.news_items?.gate1_tags || []
                // Check if job has at least one of the selected tags
                const hasTag = selectedTags.some(tag => jobTags.includes(tag))
                if (!hasTag) return
            }
            // -----------------------

            const key = job.news_id || job.id
            if (!groups[key]) {
                groups[key] = {
                    newsId: key,
                    title: job.news_items?.draft_title || job.news_items?.title || 'Untitled Post',
                    minPublishAt: job.publish_at,
                    minCreatedAt: job.created_at,
                    jobs: [],
                    status: 'scheduled'
                }
            }
            groups[key].jobs.push(job)
            if (new Date(job.publish_at) < new Date(groups[key].minPublishAt)) {
                groups[key].minPublishAt = job.publish_at
            }
            if (new Date(job.created_at) < new Date(groups[key].minCreatedAt)) {
                groups[key].minCreatedAt = job.created_at
            }
        })

        // Calculate aggregate status
        Object.values(groups).forEach(group => {
            const statuses = group.jobs.map(j => j.status)
            if (statuses.some(s => s === 'error')) group.status = 'error'
            else if (statuses.every(s => s === 'published')) group.status = 'published'
            else if (statuses.some(s => s === 'published')) group.status = 'mixed'
            else group.status = 'scheduled'
        })

        return Object.values(groups).sort((a, b) => {
            if (sortBy === 'publish_at') {
                const jobA = a.jobs.find(j => j.platform === mainPlatform)
                const jobB = b.jobs.find(j => j.platform === mainPlatform)
                const timeA = jobA ? new Date(jobA.publish_at).getTime() : new Date(a.minPublishAt).getTime()
                const timeB = jobB ? new Date(jobB.publish_at).getTime() : new Date(b.minPublishAt).getTime()
                return timeA - timeB
            } else {
                return new Date(b.minCreatedAt).getTime() - new Date(a.minCreatedAt).getTime()
            }
        })
    }, [jobs, mainPlatform, sortBy, dateRange, selectedTags])

    if (loading) return <BoardSkeleton />

    return (
        <div className="h-full overflow-y-auto">
            <div className="sticky top-0 z-50 px-6 py-4 bg-card border-b flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold tracking-tight">Publication Queue</h2>

                    {/* FILTERS */}
                    <div className="flex items-center gap-3">
                        {/* Date Range Picker (Larger) */}
                        <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-1.5 shadow-sm">
                            <span className="text-sm text-muted-foreground">From:</span>
                            <input
                                type="date"
                                className="bg-transparent text-sm focus:outline-none w-auto"
                                value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value) : undefined }))}
                            />
                            <span className="text-sm text-muted-foreground">-</span>
                            <span className="text-sm text-muted-foreground">To:</span>
                            <input
                                type="date"
                                className="bg-transparent text-sm focus:outline-none w-auto"
                                value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value) : undefined }))}
                            />
                            {(dateRange.from || dateRange.to) && (
                                <button
                                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                                    className="ml-2 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-full transition-colors"
                                >
                                    <AlertCircle className="w-4 h-4 rotate-45" />
                                </button>
                            )}
                        </div>

                        {/* Tags Filter (Popover) */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card border border-border rounded-md hover:bg-accent transition-colors shadow-sm">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                    <span>Tags</span>
                                    {selectedTags.length > 0 && (
                                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
                                            {selectedTags.length}
                                        </span>
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0 overflow-hidden" align="start">
                                {/* Header */}
                                <div className="px-4 py-3 border-b bg-gradient-to-r from-muted/50 to-muted/30">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                        Filter by Tags
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {selectedTags.length > 0 ? `${selectedTags.length} selected` : 'Select tags to filter'}
                                    </p>
                                </div>

                                {/* Tags List */}
                                <div className="p-2 max-h-[400px] overflow-y-auto">
                                    <div className="space-y-1">
                                        {AVAILABLE_TAGS.map(tag => {
                                            const isSelected = selectedTags.includes(tag)

                                            const tagColors: Record<string, { bg: string, text: string, icon: string }> = {
                                                hunting: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', icon: 'text-emerald-600 dark:text-emerald-500' },
                                                weapons: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', icon: 'text-red-600 dark:text-red-500' },
                                                dogs: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', icon: 'text-amber-600 dark:text-amber-500' },
                                                recipes: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', icon: 'text-orange-600 dark:text-orange-500' },
                                                culture: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-400', icon: 'text-purple-600 dark:text-purple-500' },
                                                travel: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', icon: 'text-blue-600 dark:text-blue-500' },
                                                law: { bg: 'bg-slate-50 dark:bg-slate-950/30', text: 'text-slate-700 dark:text-slate-400', icon: 'text-slate-600 dark:text-slate-500' },
                                                events: { bg: 'bg-pink-50 dark:bg-pink-950/30', text: 'text-pink-700 dark:text-pink-400', icon: 'text-pink-600 dark:text-pink-500' },
                                                conservation: { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', icon: 'text-green-600 dark:text-green-500' },
                                                other: { bg: 'bg-gray-50 dark:bg-gray-950/30', text: 'text-gray-700 dark:text-gray-400', icon: 'text-gray-600 dark:text-gray-500' }
                                            }

                                            const colors = tagColors[tag] || tagColors.other

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
                                                        <svg className={cn("w-3.5 h-3.5", isSelected ? colors.icon : "text-muted-foreground")} fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className={cn(
                                                            "capitalize text-sm font-medium",
                                                            isSelected ? colors.text : "text-foreground"
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

                                {/* Footer */}
                                {selectedTags.length > 0 && (
                                    <div className="p-3 border-t bg-muted/30">
                                        <button
                                            onClick={() => setSelectedTags([])}
                                            className="w-full text-sm text-muted-foreground hover:text-foreground font-medium py-2 px-3 rounded-md hover:bg-background transition-colors"
                                        >
                                            Clear all filters
                                        </button>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
                    <button
                        onClick={() => setSortBy('publish_at')}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            sortBy === 'publish_at'
                                ? "bg-background text-foreground shadow-sm border border-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <Clock className="w-4 h-4" />
                        By Publish Date
                    </button>
                    <button
                        onClick={() => setSortBy('created_at')}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            sortBy === 'created_at'
                                ? "bg-background text-foreground shadow-sm border border-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <CalendarDays className="w-4 h-4" />
                        By Approval Date
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                    {groupedNews.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-xl bg-card/30">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <CalendarDays className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">No scheduled posts</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mt-1">
                                Your queue is empty. Create a new post to get started.
                            </p>
                        </div>
                    )}

                    {groupedNews.map(group => (
                        <NewsGroupCard
                            key={group.newsId}
                            group={group}
                            onEdit={(job) => setEditingJob(job)}
                            onOpenEditor={() => setEditingNewsId(group.newsId)}
                        />
                    ))}

                    {editingJob && (
                        <EditDateDialog
                            job={editingJob}
                            onClose={() => setEditingJob(null)}
                            onSave={async (date) => {
                                try {
                                    await updateJobTime(editingJob.id, date)
                                    toast.success('Date updated')
                                    setEditingJob(null)
                                    fetchJobs()
                                } catch (e) {
                                    toast.error('Failed to update date')
                                }
                            }}
                            onDelete={async () => {
                                try {
                                    const supabase = createClient()
                                    const { error } = await supabase.from('publish_jobs').delete().eq('id', editingJob.id)
                                    if (error) throw error

                                    setEditingJob(null)
                                    fetchJobs()

                                    toast('Scheduled post deleted', {
                                        description: 'You can undo this action within 5 seconds',
                                        action: {
                                            label: 'Undo',
                                            onClick: async () => {
                                                // Remove the joined news_items data before re-inserting
                                                const { news_items, ...jobToRestore } = editingJob
                                                const { error: restoreError } = await supabase.from('publish_jobs').insert(jobToRestore as any)
                                                if (restoreError) {
                                                    toast.error('Failed to restore post')
                                                } else {
                                                    toast.success('Post restored')
                                                    fetchJobs()
                                                }
                                            }
                                        },
                                        duration: 5000,
                                    })
                                } catch (e) {
                                    toast.error('Failed to delete post')
                                }
                            }}
                        />
                    )}

                    {editingNewsId && (
                        <NewsEditorDialog
                            newsId={editingNewsId}
                            isOpen={!!editingNewsId}
                            onClose={() => setEditingNewsId(null)}
                            onSaved={() => {
                                fetchJobs()
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
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

function NewsGroupCard({ group, onEdit, onOpenEditor }: { group: GroupedNews, onEdit: (j: JobWithNews) => void, onOpenEditor: () => void }) {
    const sortedJobs = [...group.jobs].sort((a, b) => {
        if (a.platform === 'site' && b.platform !== 'site') return -1
        if (a.platform !== 'site' && b.platform === 'site') return 1
        return new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime()
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
        scheduled: {
            border: 'border-l-blue-500',
            bg: 'bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent'
        },
        mixed: {
            border: 'border-l-amber-500',
            bg: 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent'
        }
    }[group.status]

    return (
        <div
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                onOpenEditor();
            }}
            className={cn(
                "bg-card border border-border/60 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 group h-full relative cursor-pointer overflow-hidden",
                "hover:shadow-xl hover:-translate-y-2 hover:border-border",
                "border-l-[6px]",
                statusConfig.border
            )}
        >
            {/* Gradient Background Overlay */}
            <div className={cn("absolute inset-0 opacity-50 pointer-events-none", statusConfig.bg)} />

            {/* Content */}
            <div className="relative z-10 flex justify-between items-start gap-2">
                <h3 className="font-semibold text-base leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                    {group.title}
                </h3>
            </div>

            <div className="relative z-10 mt-auto pt-2 flex flex-wrap items-center gap-2.5">
                {sortedJobs.map(job => (
                    <PlatformTimeChip key={job.id} job={job} onClick={() => onEdit(job)} />
                ))}
            </div>
        </div>
    )
}

function PlatformTimeChip({ job, onClick }: { job: JobWithNews, onClick: () => void }) {
    const { icon: Icon, color, label, bgColor, borderColor } = getPlatformConfig(job.platform)

    const isPublished = job.status === 'published'
    const isError = job.status === 'error'
    const date = new Date(job.publish_at)
    const timeStr = format(date, 'd MMM, HH:mm', { locale: ru })

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
                    <p>Edit time for <b>{label}</b></p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function EditDateDialog({ job, onClose, onSave, onDelete }: { job: JobWithNews, onClose: () => void, onSave: (date: Date) => Promise<void>, onDelete: () => Promise<void> }) {
    const [dateStr, setDateStr] = useState(() => {
        const d = new Date(job.publish_at);
        const offset = d.getTimezoneOffset() * 60000;
        return (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
    })
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <h2 className="text-lg font-semibold mb-1">Reschedule {job.platform.toUpperCase()}</h2>
                <div className="space-y-4 mt-4">
                    <input
                        type="datetime-local"
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={dateStr}
                        onChange={e => setDateStr(e.target.value)}
                    />
                    <div className="flex justify-between items-center pt-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                                if (confirm('Are you sure you want to delete this scheduled post?')) {
                                    setDeleting(true)
                                    await onDelete()
                                    setDeleting(false)
                                }
                            }}
                            disabled={deleting || saving}
                            className="bg-red-500/10 text-red-600 hover:bg-red-500/20 hover:text-red-700 border-none shadow-none"
                        >
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                            <Button size="sm" onClick={() => { setSaving(true); onSave(new Date(dateStr)); }} disabled={saving || deleting}>
                                {saving ? 'Saving...' : 'Confirm'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
