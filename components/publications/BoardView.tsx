'use client'

import { useState, useEffect, useMemo } from 'react'
import { useBoardJobs, JobWithNews } from '@/hooks/useBoardJobs'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
    Send,
    Globe,
    CheckCircle2,
    AlertCircle,
    MoreHorizontal // Import the ellipsis icon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

// --- ICONS ---

function VkIcon({ className }: { className?: string }) {
    return <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M15.6 21.3c-6.6 0-10.4-4.5-10.5-12h3.3c.1 4.2 1.9 6 3.4 6.3V9.3h3.3v3.6c2-.2 4.1-2.5 4.8-5h3.1c-.6 2.5-2.2 4.4-3.5 5.2 1.3.6 3.3 2.1 4.1 5.2h-3.4c-.9-2.2-2.5-3.8-4.9-4v3.9h-.7z" /></svg>
}
function OkIcon({ className }: { className?: string }) {
    return <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M12 12.3c-1.6 0-3.3 0-3.8-1.7 0 0-.4-1.6 1.9-1.6 2.3 0 1.9 1.6 1.9 1.6.5 1.7-1.2 1.7-2.8 1.7zm0-6.8c1.6 0 2.9 1.3 2.9 2.9S13.6 11.3 12 11.3s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9zm5 11c1.3 0 1.7-1.8 1.7-1.8.3-1.3-1.4-1.3-1.4-1.3-2.3 0-3.9 0-5.3-.1-1.4.1-3 .1-5.3.1 0 0-1.7 0-1.4 1.3 0 0 .4 1.8 1.7 1.8 1.1 0 2.9 0 4.1-.1l-2.6 2.6c0 0-1.1 1.2.2 2.3.8.7 2.1-.5 2.1-.5l2.8-3 2.8 3c0 0 1.3 1.2 2.1.5 1.3-1.1.2-2.3.2-2.3l-2.6-2.6c1.2.1 3 .1 4.1.1z" /></svg>
}

const getPlatformConfig = (code: string) => {
    switch (code?.toLowerCase()) {
        case 'tg': return { icon: Send, color: 'text-blue-500', label: 'Telegram', bg: 'bg-blue-500/10 border-blue-200' }
        case 'vk': return { icon: VkIcon, color: 'text-[#0077FF]', label: 'VK', bg: 'bg-[#0077FF]/10 border-[#0077FF]/30' }
        case 'ok': return { icon: OkIcon, color: 'text-[#F97400]', label: 'OK', bg: 'bg-[#F97400]/10 border-[#F97400]/30' }
        case 'site': return { icon: Globe, color: 'text-emerald-500', label: 'Site', bg: 'bg-emerald-500/10 border-emerald-200' }
        default: return { icon: Globe, color: 'text-zinc-500', label: code, bg: 'bg-zinc-100 border-zinc-200' }
    }
}

// --- TYPES ---
type GroupedNews = {
    newsId: string
    title: string
    minPublishAt: string
    jobs: JobWithNews[]
}

export function BoardView() {
    const { jobs, loading, fetchJobs, updateJobTime } = useBoardJobs()
    const [editingJob, setEditingJob] = useState<JobWithNews | null>(null)

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
                    title: job.news_items?.title || 'Untitled Post',
                    minPublishAt: job.publish_at,
                    jobs: []
                }
            }
            groups[key].jobs.push(job)
            if (new Date(job.publish_at) < new Date(groups[key].minPublishAt)) {
                groups[key].minPublishAt = job.publish_at
            }
        })
        return Object.values(groups).sort((a, b) =>
            new Date(b.minPublishAt).getTime() - new Date(a.minPublishAt).getTime()
        )
    }, [jobs])

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading feed...</div>

    return (
        // FIXED LAYOUT: Responsive Grid instead of centered column
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {groupedNews.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-12 border-2 border-dashed rounded-xl">
                    No scheduled posts found.
                </div>
            )}

            {groupedNews.map(group => (
                <NewsGroupCard
                    key={group.newsId}
                    group={group}
                    onEdit={(job) => setEditingJob(job)}
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
                />
            )}
        </div>
    )
}

function NewsGroupCard({ group, onEdit }: { group: GroupedNews, onEdit: (j: JobWithNews) => void }) {
    const sortedJobs = [...group.jobs].sort((a, b) => {
        const order = ['tg', 'vk', 'ok', 'site']
        return order.indexOf(a.platform) - order.indexOf(b.platform)
    })

    return (
        <div className="bg-card border border-border/60 rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all group h-full">
            <h3 className="font-semibold text-base leading-snug text-foreground/90 group-hover:text-primary transition-colors">
                {group.title}
            </h3>

            <div className="mt-auto pt-2 flex flex-wrap items-center gap-3">
                {sortedJobs.map(job => (
                    <PlatformTimeChip key={job.id} job={job} onClick={() => onEdit(job)} />
                ))}
            </div>
        </div>
    )
}

function PlatformTimeChip({ job, onClick }: { job: JobWithNews, onClick: () => void }) {
    const { icon: Icon, color, label, bg } = getPlatformConfig(job.platform)

    const isPublished = job.status === 'published'
    const isError = job.status === 'error'
    const date = new Date(job.publish_at)
    const timeStr = format(date, 'd MMM, HH:mm', { locale: ru })

    let containerStyle = "border border-border bg-background text-muted-foreground hover:border-zinc-400"
    let iconStyle = color
    let textStyle = "text-foreground"

    if (isPublished) {
        containerStyle = `border ${bg.split(' ')[1]} ${bg.split(' ')[0]} bg-opacity-30`
        textStyle = "text-foreground font-medium"
    } else if (isError) {
        containerStyle = "border-red-200 bg-red-50"
        iconStyle = "text-red-600"
        textStyle = "text-red-700 font-medium"
    }

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={onClick}
                        className={`
                            flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-lg text-xs transition-all 
                            active:scale-95 group/chip border
                            ${containerStyle}
                        `}
                    >
                        <Icon className={`w-3.5 h-3.5 ${iconStyle}`} />

                        <span className={`font-mono tracking-tight whitespace-nowrap ${textStyle}`}>
                            {timeStr}
                        </span>

                        {isPublished && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-1" />}
                        {isError && <AlertCircle className="w-3 h-3 text-red-500 ml-1" />}

                        {/* VISUAL EDIT INDICATOR (...) */}
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

function EditDateDialog({ job, onClose, onSave }: { job: JobWithNews, onClose: () => void, onSave: (date: Date) => Promise<void> }) {
    const [dateStr, setDateStr] = useState(() => {
        const d = new Date(job.publish_at);
        const offset = d.getTimezoneOffset() * 60000;
        return (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
    })
    const [saving, setSaving] = useState(false)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <h2 className="text-lg font-semibold mb-1">Reschedule {job.platform.toUpperCase()}</h2>
                <div className="space-y-4 mt-4">
                    <input
                        type="datetime-local"
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={dateStr}
                        onChange={e => setDateStr(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                        <Button size="sm" onClick={() => { setSaving(true); onSave(new Date(dateStr)); }} disabled={saving}>
                            {saving ? 'Saving...' : 'Confirm'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
