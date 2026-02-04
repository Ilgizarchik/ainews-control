'use client'

import { ContentItem } from '@/types/content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ExternalLink, Clock, Tag, Star, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useEffect, useRef, useState } from 'react'
import { ContentDetailDialog } from './ContentDetailDialog'
import { approveContentItem, rejectContentItem, markContentViewed } from '@/app/actions/content-actions'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { ContentActionResultSchema } from '@/types/content-actions'

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
    const actionInFlightRef = useRef(false)

    // Sync state with props if they change to true from parent
    useEffect(() => {
        if (item.is_viewed) {
            setIsViewed(true)
        }
    }, [item.is_viewed])

    const parseActionResult = (result: unknown) => {
        const parsed = ContentActionResultSchema.safeParse(result)
        return parsed.success ? parsed.data : null
    }

    const handleCardClick = () => {
        setDetailOpen(true)

        if (!isViewed) {
            setIsViewed(true) // Optimistic update
            markContentViewed(item.id).catch(console.error)
        }
    }

    const handleApprove = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsLoading(true)

        const toastId = toast.loading('🚀 Запуск AI агентов...')

        // Simulation of progress steps
        const timers: NodeJS.Timeout[] = []
        timers.push(setTimeout(() => toast.loading('✍️ Пишем лонгрид и заголовок...', { id: toastId }), 1500))
        timers.push(setTimeout(() => toast.loading('📢 Формулируем анонс...', { id: toastId }), 5000))
        timers.push(setTimeout(() => toast.loading('🎨 Придумываем идею для картинки...', { id: toastId }), 8000))
        timers.push(setTimeout(() => toast.loading('🖼️ Генерируем изображение...', { id: toastId }), 11000))
        timers.push(setTimeout(() => toast.loading('📤 Сохраняем результаты...', { id: toastId }), 18000))

        try {
            const result = await approveContentItem(item.id)
            timers.forEach(clearTimeout) // Clear simulation if finished

            if (result.success) {
                toast.success('✨ Черновик успешно создан!', { id: toastId })
                // Now animate out
                setIsAnimatingOut('approve')
                await new Promise(resolve => setTimeout(resolve, 500))
                onActionComplete?.(item.id, 'updated')
            } else {
                toast.error(`Ошибка: ${result.error}`, { id: toastId })
                setIsLoading(false)
                if (String(result.error || '').toLowerCase().includes('already processed')) {
                    onActionComplete?.(item.id, 'stale')
                }
            }
        } catch (error) {
            timers.forEach(clearTimeout)
            toast.error('Произошла ошибка при одобрении', { id: toastId })
            setIsLoading(false)
        }
    }

    const handleReject = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsLoading(true)
        setIsAnimatingOut('reject')

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 500))

        try {
            const result = await rejectContentItem(item.id)
            if (result.success) {
                toast.success('Новость отклонена')
                onActionComplete?.(item.id, 'updated')
            } else {
                setIsAnimatingOut(null)
                toast.error(`Ошибка: ${result.error}`)
                if (String(result.error || '').toLowerCase().includes('already processed')) {
                    onActionComplete?.(item.id, 'stale')
                }
            }
        } catch (error) {
            setIsAnimatingOut(null)
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

    const getStatusBadge = () => {
        if (item.approve1_decision === 'approved') {
            return <Badge className="bg-green-600">Одобрено</Badge>
        }
        if (item.approve1_decision === 'rejected') {
            return <Badge variant="destructive">Отклонено</Badge>
        }
        return <Badge variant="secondary">Ожидание</Badge>
    }

    if (isAnimatingOut === 'approved_hidden' || isAnimatingOut === 'rejected_hidden') {
        return null
    }

    return (
        <>
            <Card
                className={cn(
                    "group relative flex flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full cursor-pointer",
                    isAnimatingOut === 'reject' && "opacity-0 translate-x-[100px] rotate-12 scale-90 bg-red-50",
                    isAnimatingOut === 'approve' && "opacity-0 -translate-y-[50px] scale-105 bg-green-50",
                    !isViewed && "ring-1 ring-blue-500/20"
                )}
                onClick={handleCardClick}
            >
                {/* Status Indicator / NEW Dot */}
                {!isViewed && (
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-in fade-in zoom-in duration-300">
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
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                    {/* Score Badge (Top Right) */}
                    <div className="absolute top-3 right-3 z-10">
                        <div className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white shadow-sm backdrop-blur-md",
                            getScoreColor(item.gate1_score)
                        )}>
                            <Star className="w-3 h-3 fill-white" />
                            {item.gate1_score ?? '--'}
                        </div>
                    </div>

                    {/* Floating Source Badge (Bottom Left) */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white/90 text-xs font-medium drop-shadow-md">
                        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md">
                            {/* Favicon placeholder could go here */}
                            <span>{item.source_name || 'unknown'}</span>
                        </div>
                        <span className="flex items-center gap-1 opacity-80">
                            · <Clock className="w-3 h-3" />
                            {item.published_at
                                ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true, locale: ru })
                                : ''}
                        </span>
                    </div>
                </div>

                <div className="flex flex-1 flex-col p-4 gap-3">
                    {/* Tags */}
                    {item.gate1_tags && item.gate1_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {item.gate1_tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/50 uppercase tracking-wide">
                                    {tag}
                                </span>
                            ))}
                            {item.gate1_tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground pt-0.5">+{item.gate1_tags.length - 3}</span>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <h3 className="font-bold text-lg leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
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
                        <div className="mt-1 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-200/80 border border-amber-100 dark:border-amber-900/50">
                            <span className="font-semibold block mb-0.5">🤖 AI Filter:</span>
                            <p className="line-clamp-2 italic">{item.gate1_reason}</p>
                        </div>
                    )}

                    {/* Actions Spacer */}
                    <div className="mt-auto pt-2" />

                    {/* Action Buttons */}
                    {!item.approve1_decision && (
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                                disabled={isLoading}
                                onClick={handleReject}
                            >
                                {isLoading && isAnimatingOut === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Отклонить'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline" // Changed to outline for softer look, or ghost-like with heavy border
                                className="h-9 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 font-semibold"
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
                                href={item.canonical_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-muted"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ExternalLink className="w-3 h-3" />
                                Читать оригинал
                            </a>
                        </div>
                    )}
                </div>
            </Card>

            <ContentDetailDialog item={item} open={detailOpen} onOpenChange={setDetailOpen} />
        </>
    )
}
