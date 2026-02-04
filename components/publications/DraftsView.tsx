'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Loader2, CalendarDays, Plus, CheckCircle2, AlertCircle, MoreHorizontal, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPlatformConfig, PLATFORM_CONFIG } from '@/lib/platform-config'
import { NewsEditorDialog } from './NewsEditorDialog'
import { SocialPostEditorDialog } from './SocialPostEditorDialog'
import { JobWithNews } from '@/hooks/useBoardJobs'
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Send } from 'lucide-react' // Added Send icon
import { publishItem } from '@/app/actions/publish-actions' // Added action import

import { Tables } from '@/types/database.types'

type DraftItem = any // Using any to avoid complex union intersections since it is a combined view

// Определяем платформы, которые могут быть добавлены к черновику
const ALL_PLATFORMS = ['tg', 'vk', 'ok', 'fb', 'x', 'threads', 'site']

export function DraftsView() {
    const [drafts, setDrafts] = useState<DraftItem[]>([])
    const [loading, setLoading] = useState(true)
    const [editingDraft, setEditingDraft] = useState<string | null>(null)
    const [editingPlatform, setEditingPlatform] = useState<{
        draftId: string
        platform: string
        content: string
        isNews: boolean
    } | null>(null)
    const [publishConfirmDraft, setPublishConfirmDraft] = useState<DraftItem | null>(null)
    const [activePlatforms, setActivePlatforms] = useState<string[]>(['site']) // 'site' is always active by default

    const supabase = createClient()

    useEffect(() => {
        fetchDrafts()
        fetchActivePlatforms()
    }, [])

    const fetchActivePlatforms = async () => {
        try {
            const { data: recipes } = await supabase
                .from('publish_recipes')
                .select('platform')
                .eq('is_active', true)

            if (recipes) {
                const platforms = recipes.map((r: any) => r.platform.toLowerCase())
                if (!platforms.includes('site')) platforms.push('site')
                setActivePlatforms(platforms)
            }
        } catch (e) {
            console.warn('[DraftsView] Failed to fetch active platforms:', e)
        }
    }

    const fetchDrafts = async () => {
        setLoading(true)
        let reviewData: any[] = []
        let newsData: any[] = []

        // 1. Fetch review_items
        try {
            const { data, error } = await supabase
                .from('review_items')
                .select('*')
                .in('status', ['needs_review', 'drafts_ready'])
                .order('created_at', { ascending: false })

            if (error) {
                console.error('[Drafts] Review items fetch error:', error)
                reviewData = []
            } else {
                reviewData = (data as any) || []
            }
        } catch (e: any) {
            console.error('[Drafts] Review items exception:', e)
        }

        // 2. Fetch news_items
        try {
            const { data, error } = await supabase
                .from('news_items')
                .select('*')
                .eq('status', 'drafts_ready')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('[Drafts] News items fetch error:', error)
                toast.error(`Ошибка загрузки новостей: ${error.message || 'Error'}`)
                newsData = []
            } else {
                newsData = (data as any) || []
            }
        } catch (e: any) {
            console.error('[Drafts] News items exception:', e)
            toast.error(`Критическая ошибка при загрузке новостей: ${e.message}`)
        }

        // 3. Combine and sort
        const combined = [
            ...reviewData,
            ...newsData.map(item => ({
                ...item,
                title_seed: item.title,
                is_news_item: true
            }))
        ]

        combined.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime()
            const dateB = new Date(b.created_at || 0).getTime()
            return dateB - dateA
        })

        console.log(`[Drafts] Loaded ${reviewData.length} reviews and ${newsData.length} news items. Total: ${combined.length}`)
        setDrafts(combined as any[])
        setLoading(false)
    }

    const handlePlatformClick = (draft: DraftItem, platform: string) => {
        // Для website берем draft_longread_site или draft_longread
        let platformContent = ''

        if (platform === 'site') {
            const siteDraft = (draft as any).draft_longread_site
            if (siteDraft !== null && siteDraft !== undefined && siteDraft !== '') {
                platformContent = siteDraft
            } else {
                platformContent = (draft as any).draft_longread || (draft as any).draft_announce || ''
            }
        } else {
            platformContent = (draft as any)[`draft_announce_${platform}`] || ''
        }

        const isNews = (draft as any).is_news_item

        setEditingPlatform({
            draftId: draft.id,
            platform,
            content: platformContent,
            isNews
        })
    }

    const handleAddPlatform = async (draftId: string, platform: string) => {
        const draft = drafts.find(d => d.id === draftId)
        if (!draft) return

        const isNews = (draft as any).is_news_item

        // Генерируем контент для этой платформы
        toast.info(`Генерация контента для ${PLATFORM_CONFIG[platform]?.label}...`)

        try {
            const response = await fetch('/api/ai/generate-platform-announces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    review_id: isNews ? undefined : draftId,
                    news_id: isNews ? draftId : undefined,
                    platforms: [platform]
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка генерации')
            }

            toast.success(`Контент для ${PLATFORM_CONFIG[platform]?.label} сгенерирован`)

            // Обновляем drafts и открываем редактор
            await fetchDrafts()

            const draft = drafts.find(d => d.id === draftId)
            if (draft) {
                const updatedDraft = { ...draft }
                if (platform === 'site') {
                    (updatedDraft as any).draft_longread_site = result.results[platform]
                } else {
                    (updatedDraft as any)[`draft_announce_${platform}`] = result.results[platform]
                }
                handlePlatformClick(updatedDraft, platform)
            }
        } catch (error: any) {
            toast.error('Ошибка: ' + error.message)
        }
    }

    const handlePublish = async (draft: DraftItem, scheduleDate?: string) => {
        const isNews = (draft as any).is_news_item;
        const loadingMsg = scheduleDate ? 'Планирование...' : 'Публикация...'
        const toastId = toast.loading(loadingMsg)

        try {
            const result = await publishItem(draft.id, isNews ? 'news' : 'review', scheduleDate)

            if (result.success) {
                if (result.isScheduled) {
                    toast.success(`Запланировано на ${format(new Date(scheduleDate!), 'dd MMM HH:mm')}`, { id: toastId })
                } else {
                    toast.success('Опубликовано успешно!', { id: toastId })
                }
                fetchDrafts() // Refresh list
            } else {
                // Partial success or error
                if (result.publishedUrl) {
                    toast.success('Частично опубликовано (см. логи)', { id: toastId })
                } else {
                    toast.error('Ошибка публикации', { id: toastId })
                }
            }
        } catch (e: any) {
            toast.error(`Ошибка: ${e.message}`, { id: toastId })
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (drafts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Нет черновиков</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-1">
                    Создайте новый материал, чтобы начать
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="p-6 space-y-6 h-full overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
                    {drafts.map(draft => (
                        <DraftCard
                            key={draft.id}
                            draft={draft}
                            activePlatforms={activePlatforms}
                            onEdit={() => setEditingDraft(draft.id)}
                            onPlatformClick={(platform) => handlePlatformClick(draft, platform)}
                            onAddPlatform={(platform) => handleAddPlatform(draft.id, platform)}
                            onPublish={() => setPublishConfirmDraft(draft)}
                        />
                    ))}
                </div>
            </div>

            {editingDraft && (
                <NewsEditorDialog
                    contentId={editingDraft}
                    contentType={(drafts.find(d => d.id === editingDraft) as any)?.is_news_item ? 'news' : 'review'}
                    isOpen={!!editingDraft}
                    onClose={() => setEditingDraft(null)}
                    onSaved={() => {
                        fetchDrafts()
                        toast.success('Черновик сохранен')
                    }}
                />
            )}

            {editingPlatform && (
                <SocialPostEditorDialog
                    job={{
                        id: '',
                        platform: editingPlatform.platform,
                        social_content: editingPlatform.content,
                        publish_at: new Date().toISOString(),
                        status: 'queued',
                        review_id: editingPlatform.isNews ? null : editingPlatform.draftId,
                        news_id: editingPlatform.isNews ? editingPlatform.draftId : null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        retry_count: 0,
                        external_id: null,
                        published_url: null,
                        published_at_actual: null,
                        error_message: null,
                        news_items: null,
                        review_items: null
                    } as JobWithNews}
                    isOpen={!!editingPlatform}
                    onClose={() => setEditingPlatform(null)}
                    onUpdate={() => {
                        fetchDrafts()
                        toast.success('Публикация сохранена')
                    }}
                />
            )}

            <Dialog open={!!publishConfirmDraft} onOpenChange={(open) => !open && setPublishConfirmDraft(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Настройка публикации</DialogTitle>
                        <DialogDescription>
                            Выберите время или опубликуйте сразу.
                            Материал: <b>{publishConfirmDraft?.draft_title || 'Без названия'}</b>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Время публикации
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="datetime-local"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    id="publish-time"
                                    defaultValue={(() => {
                                        const now = new Date()
                                        // Format manually to preserve local time: YYYY-MM-DDTHH:mm
                                        const year = now.getFullYear()
                                        const month = String(now.getMonth() + 1).padStart(2, '0')
                                        const day = String(now.getDate()).padStart(2, '0')
                                        const hours = String(now.getHours()).padStart(2, '0')
                                        const minutes = String(now.getMinutes()).padStart(2, '0')
                                        return `${year}-${month}-${day}T${hours}:${minutes}`
                                    })()}
                                />
                            </div>
                            <p className="text-[0.8rem] text-muted-foreground">
                                Оставьте текущее время для мгновенной публикации.
                            </p>
                        </div>
                    </div>


                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <div className="flex-1 flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setPublishConfirmDraft(null)}>
                                Отмена
                            </Button>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700"
                                onClick={() => {
                                    if (publishConfirmDraft) {
                                        const dateInput = document.getElementById('publish-time') as HTMLInputElement
                                        const dateVal = dateInput.value ? new Date(dateInput.value).toISOString() : undefined
                                        handlePublish(publishConfirmDraft, dateVal)
                                        setPublishConfirmDraft(null)
                                    }
                                }}
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Опубликовать
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function DraftCard({
    draft,
    activePlatforms,
    onEdit,
    onPlatformClick,
    onAddPlatform,
    onPublish
}: {
    draft: DraftItem
    activePlatforms: string[]
    onEdit: () => void
    onPlatformClick: (platform: string) => void
    onAddPlatform: (platform: string) => void
    onPublish: () => void
}) {
    // В черновик карточка должна попадать без площадок, если текста для них не готовы. (User Request)
    // Строгая проверка: только если draft_longread_site заполнен.
    // Cast to any because types might be stale
    const hasSite = (draft as any).draft_longread_site && (draft as any).draft_longread_site.trim().length > 0

    // Остальные платформы (кроме site) с контентом
    const otherPlatformsWithContent = ALL_PLATFORMS
        .filter(platform => platform !== 'site')
        .filter(platform => {
            const content = (draft as any)[`draft_announce_${platform}`]
            return content && content.trim().length > 0
        })

    const platformsWithContent = hasSite
        ? ['site', ...otherPlatformsWithContent]
        : otherPlatformsWithContent

    const availablePlatforms = ALL_PLATFORMS.filter(p =>
        !platformsWithContent.includes(p) && activePlatforms.includes(p)
    )

    return (
        <div
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return
                onEdit()
            }}
            className={cn(
                "bg-card border border-border/60 rounded-xl overflow-hidden flex flex-col gap-0 transition-all duration-300 group h-full relative cursor-pointer",
                "hover:shadow-xl hover:-translate-y-2 hover:border-border",
                // Show border color if scheduled?
                "border-l-[6px] border-l-amber-500"
            )}
        >
            {/* Image Preview */}
            {draft.draft_image_file_id && (
                <div className="relative w-full h-40 overflow-hidden shrink-0 bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`/api/telegram/photo/${draft.draft_image_file_id}`}
                        alt={draft.draft_title || draft.title_seed || 'Preview'}
                        className="absolute inset-[-1px] w-[calc(100%+2px)] h-[calc(100%+2px)] object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {/* Solid bottom gradient to perfectly blend with the card background */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/90 to-transparent z-10" />
                </div>
            )}

            {/* Content */}
            <div className="p-5 flex flex-col gap-4 flex-1 relative z-20 bg-card -mt-1">
                <div className="relative z-10 flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-base leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                        {draft.draft_title || draft.title_seed || 'Без названия'}
                    </h3>
                    <div className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium shrink-0">
                        Черновик
                    </div>
                </div>

                {/* Platforms */}
                <div className="relative z-10 mt-auto pt-2 flex flex-wrap items-center gap-2.5">
                    {platformsWithContent.length > 0 ? (
                        platformsWithContent.map(platform => (
                            <PlatformChip
                                key={platform}
                                platform={platform}
                                isMain={platform === 'site'}
                                onClick={() => onPlatformClick(platform)}
                            />
                        ))
                    ) : (
                        <div className="text-xs text-muted-foreground italic">
                            Нет готовых платформ
                        </div>
                    )}

                    {/* Add Platform Button */}
                    {availablePlatforms.length > 0 && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="group relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-110 active:scale-95">
                                    {/* Glow effect */}
                                    <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300" />
                                    {/* Plus icon */}
                                    <Plus className="relative w-4 h-4 text-white stroke-[2.5]" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="start">
                                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                                    Добавить платформу
                                </div>
                                {availablePlatforms.map(platform => {
                                    const config = getPlatformConfig(platform)
                                    const Icon = config.icon
                                    return (
                                        <button
                                            key={platform}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onAddPlatform(platform)
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-left transition-colors"
                                        >
                                            <Icon className={cn("w-4 h-4", config.color)} />
                                            <span>{config.label}</span>
                                            <Sparkles className="w-3 h-3 ml-auto text-emerald-500" />
                                        </button>
                                    )
                                })}
                            </PopoverContent>
                        </Popover>
                    )}

                    {/* Action Buttons: Publish/Schedule */}
                    <div className="ml-auto flex items-center gap-1">
                        {/*
                           REMOVED Calendar Button as per request.
                           Button "Send" now handles both.
                     {/* Publish Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                if (!hasSite) {
                                    toast.error('Для публикации необходим контент для Сайта (главная платформа)')
                                    return
                                }
                                onPublish()
                            }}
                            className={cn(
                                "flex items-center justify-center w-9 h-9 ml-auto rounded-full shadow-md transition-all group/pub",
                                hasSite
                                    ? "bg-blue-600 hover:bg-blue-700 hover:scale-110 active:scale-95 cursor-pointer"
                                    : "bg-gray-300 dark:bg-gray-600 opacity-70 cursor-not-allowed text-muted-foreground"
                            )}
                            title={hasSite ? "Опубликовать" : "Необходимо подготовить контент для Сайта"}
                        >
                            <Send className={cn("w-4 h-4", hasSite ? "text-white" : "text-gray-500 dark:text-gray-400")} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PlatformChip({ platform, isMain, onClick }: { platform: string, isMain?: boolean, onClick: () => void }) {
    const { icon: Icon, color, label, bgColor, borderColor } = getPlatformConfig(platform)

    const containerStyle = isMain
        ? cn(
            "border-2 bg-gradient-to-br shadow-md",
            "from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20",
            "border-emerald-400 dark:border-emerald-600"
        )
        : cn(
            "border-2 bg-gradient-to-br text-foreground shadow-sm hover:shadow-md",
            borderColor,
            bgColor
        )

    const iconStyle = isMain ? "text-emerald-600 dark:text-emerald-400" : color
    const textStyle = isMain ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "font-medium text-foreground"

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onClick()
                        }}
                        className={cn(
                            "flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg text-xs transition-all active:scale-95 group/chip",
                            "hover:scale-105 hover:-translate-y-0.5",
                            containerStyle
                        )}
                    >
                        <Icon className={cn("w-4 h-4", iconStyle)} />

                        <span className={cn("tracking-tight whitespace-nowrap", textStyle)}>
                            {label}
                        </span>

                        <div className="pl-1.5 border-l-2 border-border/50 ml-0.5">
                            <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/chip:text-foreground transition-colors" />
                        </div>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                    <p>Редактировать <b>{label}</b>{isMain && ' (главная)'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
