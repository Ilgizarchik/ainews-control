'use client'

import { ContentItem } from '@/types/content'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ExternalLink, Clock, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useEffect, useState, useRef } from 'react'
import { ContentDetailDialog } from './ContentDetailDialog'
import { approveContentItem, rejectContentItem, markContentViewed } from '@/app/actions/content-actions'
import { toast, showUndoToast } from '@/components/ui/premium-toasts'
import { Loader2 } from 'lucide-react'
import { ensureAbsoluteUrl } from '@/lib/utils'

interface ContentCardProps {
    item: ContentItem
    onActionComplete?: (id: string, outcome?: 'updated' | 'stale') => void
}

export function ContentCard({ item, onActionComplete }: ContentCardProps) {
    const [detailOpen, setDetailOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isAnimatingOut, setIsAnimatingOut] = useState<'approve' | 'reject' | 'approved_hidden' | 'rejected_hidden' | null>(null)
    const [isViewed, setIsViewed] = useState(item.is_viewed ?? false)
    const [imageError, setImageError] = useState(false)
    // Sync state with props if they change to true from parent
    useEffect(() => {
        if (item.is_viewed) {
            setIsViewed(true)
        }
    }, [item.is_viewed])

    const handleCardClick = () => {
        setDetailOpen(true)

        if (!isViewed) {
            setIsViewed(true) // Optimistic update
            markContentViewed(item.id).catch(console.error)
        }
    }

    // Keep track of toastId ref to clear it on unmount
    const toastIdRef = useRef<string | number | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current);
            }
        };
    }, []);

    const handleApprove = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setIsLoading(true)

        const toastId = toast.loading('🚀 Запуск AI агентов...')
        toastIdRef.current = toastId;

        // Simulation of progress steps
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

            // Clear ALL timers immediately
            timers.forEach(clearTimeout)
            // Force dismiss the loading toast
            toast.dismiss(toastId)
            toastIdRef.current = null;

            if (result.success) {
                toast.success('✨ Черновик успешно создан!')
                // Now animate out
                setIsAnimatingOut('approve')
                await new Promise(resolve => setTimeout(resolve, 500))
                onActionComplete?.(item.id, 'updated')
            } else {
                toast.error(`Ошибка: ${result.error}`)
                setIsLoading(false)
                if (String(result.error || '').toLowerCase().includes('already processed')) {
                    onActionComplete?.(item.id, 'stale')
                }
            }
        } catch {
            timers.forEach(clearTimeout)
            toast.dismiss(toastId)
            toastIdRef.current = null;
            toast.error('Произошла ошибка при одобрении')
            setIsLoading(false)
        }
    }

    const handleReject = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setDetailOpen(false) // Close dialog if open
        // Optimistic UI: Animate out immediately
        setIsAnimatingOut('reject')

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 500))
        setIsAnimatingOut('rejected_hidden') // Hide from view

        // Define cleanup to restore card if cancelled
        const handleUndo = () => {
            setIsAnimatingOut(null)
        }

        // Define commit action
        const handleCommit = async () => {
            try {
                const result = await rejectContentItem(item.id)
                if (result.success) {
                    onActionComplete?.(item.id, 'updated')
                    toast.success('Готово!', { description: 'Новость отклонена' })
                } else {
                    handleUndo() // Restore on error
                    toast.error(`Ошибка при отклонении: ${result.error}`)
                }
            } catch {
                handleUndo()
                toast.error('Произошла ошибка при отклонении')
            }
        }

        // Show Standardized Undo Toast
        showUndoToast({
            message: "Отклонение...",
            description: "Новость будет удалена",
            duration: 7000,
            onUndo: handleUndo,
            onCommit: handleCommit,
            type: 'danger'
        })
    }

    const getScoreColor = (score: number | null) => {
        if (!score) return 'bg-gray-500'
        if (score >= 80) return 'bg-green-500'
        if (score >= 50) return 'bg-yellow-500'
        return 'bg-red-500'
    }

    if (isAnimatingOut === 'approved_hidden' || isAnimatingOut === 'rejected_hidden') {
        return null
    }

    return (
        <>
            <Card
                data-tutorial="moderation-card"
                className={cn(
                    "group relative flex flex-col overflow-hidden border-2 bg-card transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-2 h-full cursor-pointer rounded-2xl",
                    isAnimatingOut === 'reject' && "opacity-0 translate-x-[100px] rotate-12 scale-90 bg-red-50",
                    isAnimatingOut === 'approve' && "opacity-0 -translate-y-[50px] scale-105 bg-green-50",
                    !isViewed && "ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
                )}
                onClick={handleCardClick}
            >
                {/* Status Indicator / NEW Dot */}
                {!isViewed && (
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-blue-500/50 animate-in fade-in zoom-in duration-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        NEW
                    </div>
                )}

                {/* Cover Image Area */}
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                    {item.image_url && !imageError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={`/api/image-proxy?url=${encodeURIComponent(item.image_url)}`}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            onError={() => setImageError(true)}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/50 to-muted text-muted-foreground p-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-3xl">📰</span>
                                <span className="text-xs font-medium opacity-70">Нет изображения</span>
                            </div>
                        </div>
                    )}

                    {/* Overlay Gradient for Text Contrast (bottom) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70" />

                    {/* Score Badge (Top Right) */}
                    <div data-tutorial="moderation-card-score" className="absolute top-4 right-4 z-10">
                        <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-white shadow-xl backdrop-blur-md border border-white/20",
                            getScoreColor(item.gate1_score)
                        )}>
                            <Star className="w-3.5 h-3.5 fill-white" />
                            {item.gate1_score ?? '--'}
                        </div>
                    </div>

                    {/* Floating Source Badge (Bottom Left) */}
                    <div className="absolute bottom-4 left-4 z-10 max-w-[calc(100%-2rem)]">
                        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-xl px-3 py-2 rounded-xl border border-white/20 shadow-xl transition-all hover:bg-black/90 hover:scale-105 overflow-hidden">
                            <span className="font-bold text-white text-[11px] tracking-wider uppercase truncate min-w-[30px] flex-shrink-1">
                                {item.source_name || 'source'}
                            </span>
                            <span className="w-px h-3 bg-white/30 flex-shrink-0" />
                            <span className="flex items-center gap-1.5 text-[11px] text-white/90 font-medium whitespace-nowrap overflow-hidden">
                                <Clock className="w-3 h-3 opacity-80 flex-shrink-0" />
                                <span className="truncate">
                                    {item.published_at
                                        ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true, locale: ru })
                                        : ''}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 flex-col p-5 gap-3">
                    {/* Tags */}
                    {item.gate1_tags && item.gate1_tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {item.gate1_tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider shadow-sm">
                                    {tag}
                                </span>
                            ))}
                            {item.gate1_tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground pt-1 font-semibold">+{item.gate1_tags.length - 3}</span>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <h3 className="font-black text-xl leading-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {item.title}
                    </h3>

                    {/* Summary */}
                    {item.rss_summary && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                            {item.rss_summary}
                        </p>
                    )}

                    {/* AI Reason (if present) - collapsible or subtle */}
                    {item.gate1_reason && (
                        <div data-tutorial="moderation-card-ai" className="mt-1 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 border-2 border-amber-200 dark:border-amber-800 shadow-sm">
                            <span className="font-black block mb-1 flex items-center gap-1.5">
                                <span className="text-sm">🤖</span> AI Filter:
                            </span>
                            <p className="italic font-medium text-sm leading-relaxed">{item.gate1_reason}</p>
                        </div>
                    )}

                    {/* Actions Spacer */}
                    <div className="mt-auto pt-2" />

                    {/* Action Buttons */}
                    {!item.approve1_decision && (
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                data-tutorial="moderation-card-reject"
                                size="sm"
                                variant="outline"
                                className="h-10 rounded-xl border-2 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 dark:hover:bg-rose-600 font-bold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-rose-500/30"
                                disabled={isLoading}
                                onClick={handleReject}
                            >
                                {isLoading && isAnimatingOut === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Отклонить'}
                            </Button>
                            <Button
                                data-tutorial="moderation-card-approve"
                                size="sm"
                                variant="outline"
                                className="h-10 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 dark:hover:bg-emerald-600 font-bold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/30"
                                disabled={isLoading}
                                onClick={handleApprove}
                            >
                                {isLoading && isAnimatingOut === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Одобрить'}
                            </Button>
                        </div>
                    )}

                    {!item.approve1_decision && (
                        <div className="flex justify-center pt-1">
                            <a
                                href={ensureAbsoluteUrl(item.canonical_url, item.source_name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold group/link"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ExternalLink className="w-3.5 h-3.5 group-hover/link:rotate-12 transition-transform" />
                                Читать оригинал
                            </a>
                        </div>
                    )}
                </div>
            </Card>

            <ContentDetailDialog
                item={item}
                open={detailOpen}
                onOpenChange={setDetailOpen}
                onActionComplete={onActionComplete}
                onApprove={() => handleApprove()}
                onReject={() => handleReject()}
            />
        </>
    )
}
