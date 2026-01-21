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
    CalendarDays
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
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

    useEffect(() => {
        fetchJobs()
    }, [fetchJobs])

    const groupedNews = useMemo(() => {
        const groups: Record<string, GroupedNews> = {}
        jobs.forEach(job => {
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
    }, [jobs, mainPlatform, sortBy])

    if (loading) return <BoardSkeleton />

    return (
        <div className="p-6 space-y-6 h-full overflow-y-auto">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Publication Queue</h2>
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
                    <button
                        onClick={() => setSortBy('publish_at')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
                            sortBy === 'publish_at'
                                ? "bg-background text-foreground shadow-sm border border-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        By Publish Date
                    </button>
                    <button
                        onClick={() => setSortBy('created_at')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
                            sortBy === 'created_at'
                                ? "bg-background text-foreground shadow-sm border border-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <CalendarDays className="w-3.5 h-3.5" />
                        By Approval Date
                    </button>
                </div>
            </div>

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

    const statusColor = {
        published: 'border-l-emerald-500',
        error: 'border-l-red-500',
        scheduled: 'border-l-blue-500',
        mixed: 'border-l-amber-500'
    }[group.status]

    return (
        <div
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                onOpenEditor();
            }}
            className={cn(
                "bg-card border border-border/60 rounded-xl p-5 flex flex-col gap-4 shadow-sm transition-all duration-300 group h-full relative cursor-pointer",
                "hover:shadow-lg hover:-translate-y-1 hover:border-border",
                "border-l-4",
                statusColor
            )}>
            <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold text-base leading-snug text-foreground/90 group-hover:text-primary transition-colors line-clamp-2">
                    {group.title}
                </h3>
            </div>

            <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
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

    let containerStyle = cn("border bg-background text-muted-foreground hover:border-zinc-400", borderColor)
    let iconStyle = color
    let textStyle = "text-foreground"

    if (isPublished) {
        containerStyle = cn("bg-opacity-30", bgColor, borderColor)
        textStyle = "text-foreground font-medium"
    } else if (isError) {
        containerStyle = "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
        iconStyle = "text-red-600 dark:text-red-400"
        textStyle = "text-red-700 dark:text-red-300 font-medium"
    }

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={onClick}
                        className={cn(
                            "flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-lg text-xs transition-all active:scale-95 group/chip border",
                            containerStyle
                        )}
                    >
                        <Icon className={cn("w-3.5 h-3.5", iconStyle)} />

                        <span className={cn("font-mono tracking-tight whitespace-nowrap", textStyle)}>
                            {timeStr}
                        </span>

                        {isPublished && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-1" />}
                        {isError && <AlertCircle className="w-3 h-3 text-red-500 ml-1" />}

                        {!isPublished && !isError && (
                            <div className="pl-1 border-l border-border/50 ml-1">
                                <MoreHorizontal className="w-3 h-3 text-muted-foreground/50 group-hover/chip:text-foreground transition-colors" />
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
