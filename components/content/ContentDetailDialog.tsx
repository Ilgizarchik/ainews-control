'use client'

import { ContentItem } from '@/types/content'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Calendar, Star, Tag } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { approveContentItem, rejectContentItem } from '@/app/actions/content-actions'
import { ensureAbsoluteUrl } from '@/lib/utils'
import { toast } from '@/components/ui/premium-toasts'
import { Loader2 } from 'lucide-react'

interface ContentDetailDialogProps {
    item: ContentItem
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ContentDetailDialog({ item, open, onOpenChange }: ContentDetailDialogProps) {
    // Track which specific action is loading: 'approve' | 'reject' | null
    const [loadingAction, setLoadingAction] = useState<'approve' | 'reject' | null>(null)

    const handleApprove = async () => {
        setLoadingAction('approve')

        // Immediate feedback
        const toastId = toast.loading('🚀 Запуск AI агентов...')

        // Simulation of progress steps (visual feedback only)
        const timers: NodeJS.Timeout[] = []
        timers.push(setTimeout(() => toast.loading('✍️ Пишем лонгрид и заголовок...', { id: toastId }), 2000))
        timers.push(setTimeout(() => toast.loading('📢 Формулируем анонс...', { id: toastId }), 7000))
        timers.push(setTimeout(() => toast.loading('🎨 Придумываем идею для картинки...', { id: toastId }), 14000))
        timers.push(setTimeout(() => toast.loading('🖼️ Генерируем изображение...', { id: toastId }), 22000))
        timers.push(setTimeout(() => toast.loading('📤 Сохраняем результаты...', { id: toastId }), 35000))
        timers.push(setTimeout(() => toast.loading('🛠️ Финализируем метаданные...', { id: toastId }), 45000))
        timers.push(setTimeout(() => toast.loading('📊 Почти готово, последние штрихи...', { id: toastId }), 55000))

        try {
            const result = await approveContentItem(item.id)
            timers.forEach(clearTimeout) // Clear simulation if finished earlier
            toast.dismiss(toastId)

            if (result.success) {
                toast.success('✨ Черновик успешно создан!')
                onOpenChange(false)
            } else {
                const errorMsg = result.error?.message || String(result.error)
                toast.error(`Ошибка: ${errorMsg}`)
            }
        } catch (error: any) {
            timers.forEach(clearTimeout)
            toast.dismiss(toastId)
            toast.error(`Произошла ошибка: ${error.message || error}`)
        } finally {
            setLoadingAction(null)
        }
    }

    const handleReject = async () => {
        // Optimistic UI: Close immediately
        onOpenChange(false)

        let isCancelled = false

        // Delay actual execution
        const timerId = setTimeout(async () => {
            if (isCancelled) return

            try {
                const result = await rejectContentItem(item.id)
                if (result.success) {
                    // Success silently updates (or parent refreshes)
                } else {
                    const errorMsg = result.error?.message || String(result.error)
                    toast.error(`Ошибка при отклонении: ${errorMsg}`)
                }
            } catch (error: any) {
                toast.error(`Произошла ошибка при отклонении: ${error.message || error}`)
            }
        }, 7000)

        toast("Новость отклонена", {
            description: "Действие будет применено через 7 секунд",
            action: {
                label: "Отменить",
                onClick: () => {
                    isCancelled = true
                    clearTimeout(timerId)
                    onOpenChange(true) // Re-open dialog on undo
                    toast.dismiss()
                }
            },
            duration: 7000,
        })
    }
    const getScoreColor = (score: number | null) => {
        if (!score) return 'bg-gray-500'
        if (score >= 80) return 'bg-green-500'
        if (score >= 50) return 'bg-yellow-500'
        return 'bg-red-500'
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-background border-2 border-border/50 shadow-2xl rounded-3xl">
                {/* Premium Header Image with Dark Gradient Overlay */}
                <div className="relative w-full h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
                    {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={`/api/image-proxy?url=${encodeURIComponent(item.image_url)}`}
                            alt={item.title}
                            className="w-full h-full object-cover opacity-40"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="flex w-full h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 text-muted-foreground/50">
                            <span className="text-7xl">📰</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

                    {/* Floating Premium Badges */}
                    <div className="absolute bottom-4 left-6 flex gap-2">
                        <Badge className={cn("text-white font-black text-sm px-3 py-1.5 shadow-2xl backdrop-blur-xl border-2 border-white/30 rounded-xl", getScoreColor(item.gate1_score))}>
                            <Star className="w-3.5 h-3.5 mr-1.5 fill-white drop-shadow-lg" />
                            {item.gate1_score ?? '—'}
                        </Badge>
                        <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-xl border-2 border-white/20 shadow-2xl font-bold text-xs px-3 py-1.5 rounded-xl">
                            {item.source_name}
                        </Badge>
                    </div>
                </div>

                <div className="p-4 md:p-6 space-y-4 -mt-6 relative z-10">
                    {/* Header Section */}
                    <DialogHeader className="space-y-5">
                        <DialogTitle className="text-3xl md:text-4xl font-black leading-tight tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            {item.title}
                        </DialogTitle>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                            {item.published_at && (
                                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 px-4 py-2 rounded-full border-2 border-emerald-200 dark:border-emerald-800 shadow-sm">
                                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                        {format(new Date(item.published_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
                                    </span>
                                </div>
                            )}
                            {item.gate1_decision && (
                                <Badge variant={item.gate1_decision === 'send' ? 'outline' : 'destructive'} className="uppercase text-[11px] tracking-widest font-black border-2 px-3 py-1 rounded-full shadow-sm">
                                    AI: {item.gate1_decision === 'send' ? 'PASS' : 'BLOCK'}
                                </Badge>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
                        {/* Main Content Column */}
                        <div className="space-y-4">
                            {/* Summary */}
                            {item.rss_summary && (
                                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed bg-gradient-to-br from-muted/40 to-muted/20 p-4 rounded-2xl border-2 border-border/50 shadow-lg">
                                    <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <span className="text-xl">📝</span> SUMMARY
                                    </h3>
                                    <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{item.rss_summary}</p>
                                </div>
                            )}

                            {/* AI Reason */}
                            {item.gate1_reason && (
                                <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-amber-950/30 p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 shadow-lg">
                                    <h3 className="text-xs font-black uppercase tracking-widest mb-2 text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                        <span className="text-base">🤖</span> WHY THIS SCORE?
                                    </h3>
                                    <p className="text-sm italic leading-relaxed font-medium">&ldquo;{item.gate1_reason}&rdquo;</p>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Column */}
                        <div className="space-y-4">
                            {/* Tags */}
                            {item.gate1_tags && item.gate1_tags.length > 0 && (
                                <div className="space-y-2 p-3 bg-gradient-to-br from-muted/30 to-muted/10 rounded-2xl border-2 border-border/50 shadow-md">
                                    <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                        <Tag className="w-3.5 h-3.5" /> TAGS
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {item.gate1_tags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm">
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
                                className="flex items-center justify-between p-3 rounded-2xl border-2 border-border hover:border-emerald-500 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all group shadow-md hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105 duration-300"
                            >
                                <span className="text-sm font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Original Source</span>
                                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-all group-hover:rotate-12" />
                            </a>

                            {/* Moderator Info (If processed) */}
                            {item.approve1_decision && (
                                <div className="p-3 bg-gradient-to-br from-muted/40 to-muted/20 rounded-2xl border-2 border-border/50 space-y-2 shadow-md">
                                    <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest">REVIEW STATUS</h4>
                                    <div className={cn("text-sm font-black flex items-center gap-2",
                                        item.approve1_decision === 'approved' ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400"
                                    )}>
                                        {item.approve1_decision === 'approved' ? (
                                            <><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" /> Approved</>
                                        ) : (
                                            <><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50 animate-pulse" /> Rejected</>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-semibold">
                                        {item.approve1_decided_at && format(new Date(item.approve1_decided_at), 'd MMM, HH:mm', { locale: ru })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Premium Footer Actions */}
                <div className="p-6 border-t-2 border-border bg-gradient-to-r from-muted/30 to-muted/10 flex flex-col sm:flex-row gap-4 justify-end items-center backdrop-blur-xl rounded-b-3xl">
                    {!item.approve1_decision ? (
                        <>
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto h-12 rounded-xl border-2 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 dark:hover:bg-rose-600 font-bold transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-rose-500/30 px-8"
                                onClick={handleReject}
                                disabled={loadingAction === 'reject' || loadingAction === 'approve'}
                            >
                                {loadingAction === 'reject' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                Отклонить
                            </Button>
                            <Button
                                className="w-full sm:w-auto h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/30 font-black text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/40 px-8"
                                onClick={handleApprove}
                                disabled={loadingAction === 'approve' || loadingAction === 'reject'}
                            >
                                {loadingAction === 'approve' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                🚀 Одобрить и запустить AI
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold">
                            Закрыть
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
