'use client'

import { ContentItem } from '@/types/content'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, Calendar, User, Star, Tag, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { approveContentItem, rejectContentItem } from '@/app/actions/content-actions'
import { ensureAbsoluteUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface ContentDetailDialogProps {
    item: ContentItem
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ContentDetailDialog({ item, open, onOpenChange }: ContentDetailDialogProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleApprove = async () => {
        setIsLoading(true)
        try {
            const result = await approveContentItem(item.id)
            if (result.success) {
                toast.success('Новость одобрена!')
                onOpenChange(false)
            } else {
                toast.error(`Ошибка: ${result.error}`)
            }
        } catch (error) {
            toast.error('Произошла ошибка при одобрении')
        } finally {
            setIsLoading(false)
        }
    }

    const handleReject = async () => {
        setIsLoading(true)
        try {
            const result = await rejectContentItem(item.id)
            if (result.success) {
                toast.success('Новость отклонена')
                onOpenChange(false)
            } else {
                toast.error(`Ошибка: ${result.error}`)
            }
        } catch (error) {
            toast.error('Произошла ошибка при отклонении')
        } finally {
            setIsLoading(false)
        }
    }
    const getScoreColor = (score: number | null) => {
        if (!score) return 'bg-gray-500'
        if (score >= 80) return 'bg-green-500'
        if (score >= 50) return 'bg-yellow-500'
        return 'bg-red-500'
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50">
                {/* Header Image (Parallax-like) */}
                <div className="relative w-full h-64 bg-muted overflow-hidden">
                    {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={`/api/image-proxy?url=${encodeURIComponent(item.image_url)}`}
                            alt={item.title}
                            className="w-full h-full object-cover opacity-90"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="flex w-full h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 text-muted-foreground/50">
                            <span className="text-5xl">📰</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />

                    {/* Floating Badges */}
                    <div className="absolute bottom-4 left-6 flex gap-2">
                        <Badge className={cn("text-white font-bold text-sm px-2.5 shadow-lg backdrop-blur-md", getScoreColor(item.gate1_score))}>
                            <Star className="w-3.5 h-3.5 mr-1.5 fill-white" />
                            {item.gate1_score ?? '—'}
                        </Badge>
                        <Badge variant="secondary" className="bg-black/40 text-white backdrop-blur-md border-white/10 shadow-lg">
                            {item.source_name}
                        </Badge>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-8 -mt-6 relative z-10">
                    {/* Header Section */}
                    <DialogHeader className="space-y-4">
                        <DialogTitle className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
                            {item.title}
                        </DialogTitle>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {item.published_at && (
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    {format(new Date(item.published_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
                                </div>
                            )}
                            {item.gate1_decision && (
                                <Badge variant={item.gate1_decision === 'send' ? 'outline' : 'destructive'} className="uppercase text-[10px] tracking-wider font-semibold">
                                    AI: {item.gate1_decision === 'send' ? 'PASS' : 'BLOCK'}
                                </Badge>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
                        {/* Main Content Column */}
                        <div className="space-y-6">
                            {/* Summary */}
                            {item.rss_summary && (
                                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/50">
                                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <span className="text-xl">📝</span> Summary
                                    </h3>
                                    <p className="whitespace-pre-wrap font-sans text-base">{item.rss_summary}</p>
                                </div>
                            )}

                            {/* AI Reason */}
                            {item.gate1_reason && (
                                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/40 text-amber-900 dark:text-amber-100">
                                    <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-amber-600 dark:text-amber-400">Why this score?</h3>
                                    <p className="text-sm italic leading-relaxed">"{item.gate1_reason}"</p>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Column */}
                        <div className="space-y-6">
                            {/* Tags */}
                            {item.gate1_tags && item.gate1_tags.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {item.gate1_tags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="px-2.5 py-1 text-xs">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Original Link */}
                            <a
                                href={ensureAbsoluteUrl(item.canonical_url, item.source_name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                            >
                                <span className="text-sm font-medium">Original Source</span>
                                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </a>

                            {/* Moderator Info (If processed) */}
                            {item.approve1_decision && (
                                <div className="p-4 bg-muted/40 rounded-xl border border-border/50 space-y-2">
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Review Status</h4>
                                    <div className={cn("text-sm font-bold flex items-center gap-2",
                                        item.approve1_decision === 'approved' ? "text-green-600" : "text-rose-600"
                                    )}>
                                        {item.approve1_decision === 'approved' ? (
                                            <><div className="w-2 h-2 rounded-full bg-green-500" /> Approved</>
                                        ) : (
                                            <><div className="w-2 h-2 rounded-full bg-rose-500" /> Rejected</>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {item.approve1_decided_at && format(new Date(item.approve1_decided_at), 'd MMM, HH:mm', { locale: ru })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-3 justify-end items-center sticky bottom-0 backdrop-blur-xl">
                    {!item.approve1_decision ? (
                        <>
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                onClick={handleReject}
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Отклонить
                            </Button>
                            <Button
                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                                onClick={handleApprove}
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                🚀 Одобрить и запустить AI
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            Закрыть
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
