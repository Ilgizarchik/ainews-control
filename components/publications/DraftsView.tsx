'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarDays, Plus, Sparkles, Download } from 'lucide-react'
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
import { downloadImageAsJpg } from '@/lib/image-utils'


type DraftItem = any // Using any to avoid complex union intersections since it is a combined view

// Определяем платформы, которые могут быть добавлены к черновику
const ALL_PLATFORMS = ['tg', 'vk', 'ok', 'fb', 'x', 'threads', 'site']

const LOADING_MESSAGES = [
    "Готовлю для тебя контент, подожди пожалуйста... 🍳",
    "Прогреваю нейросети... 🔥",
    "Потерпи пожалуйста, скоро будет готово... ⏳",
    "Разгоняю цифровые нейроны... 🧠",
    "Договариваюсь с музой... 🧚‍♀️",
    "Фух, я почти закончил, наношу последние штрихи... 🎨",
    "Еще чуть-чуть, магия требует времени... ✨",
    "Завариваю цифровой кофе... ☕",
    "Учу искусственный интеллект хорошим манерам... 🎩",
    "Ищу вдохновение в облаках данных... ☁️",
    "Собираю слова в предложения... 🧩",
    "Подбираю идеальные эпитеты... 💎",
    "Вычесываю баги из текста... 🐞",
    "Полирую запятые и точки... 🧹",
    "Консультируюсь с духом интернета... 👻",
    "Перевожу с бинарного на человеческий... 0️⃣1️⃣",
    "Ловлю креативные мысли сачком... 🦋",
    "Заряжаю слова смыслом... 🔋",
    "Распутываю клубок смыслов... 🧶",
    "Добавляю щепотку харизмы... 🧂",
    "Сдуваю пыль с серверов... 🌬️",
    "Уговариваю алгоритмы работать быстрее... 🏃",
    "Рисую словами картину мира... 🖌️",
    "Строю мосты между фактами... 🌉",
    "Сортирую пиксели для красоты... 🖼️",
    "Включаю режим гения... 💡",
    "Заливаю топливо в генератор идей... ⛽",
    "Настраиваю частоту вещания успеха... 📻",
    "Открываю чакры продуктивности... 🧘",
    "Пишу шедевр, не подсматривай... 🫣",
    "Запускаю двигатели креативности... 🚀"
]

export function DraftsView() {
    const [drafts, setDrafts] = useState<DraftItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [editingDraft, setEditingDraft] = useState<string | null>(null)
    const [editingPlatform, setEditingPlatform] = useState<{
        draftId: string
        platform: string
        content: string
        isNews: boolean
    } | null>(null)
    const [publishConfirmDraft, setPublishConfirmDraft] = useState<DraftItem | null>(null)
    const [activePlatforms, setActivePlatforms] = useState<string[]>(['site']) // 'site' is always active by default

    // Инициализируем клиент вне тела ререндера, если это возможно, или через useMemo
    const supabase = useMemo(() => createClient(), [])

    // --- Callbacks ---

    const fetchActivePlatforms = useCallback(async (): Promise<void> => {
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
    }, [supabase])

    const fetchDrafts = useCallback(async (isInitial: boolean = false): Promise<void> => {
        // Validation: ensure environment variables are present on the client
        const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!sbUrl || !sbKey) {
            console.error('[Drafts] Supabase configuration missing on client!', { url: !!sbUrl, key: !!sbKey });
            toast.error('Ошибка конфигурации: отсутствует подключение к Supabase');
            setLoading(false);
            return;
        }

        if (isInitial) setLoading(true)
        else setRefreshing(true)
        let reviewData: any[] = []
        let newsData: any[] = []

        // 1. Fetch review_items. Use * to be resilient against missing columns in the DB.
        try {
            const { data, error } = await supabase
                .from('review_items')
                .select('*')
                .in('status', ['needs_review', 'drafts_ready'])
                .order('created_at', { ascending: false })

            if (error) {
                console.error('[Drafts] Review items fetch error:', error.message || error)
                reviewData = []
            } else {
                reviewData = (data as any) || []
            }
        } catch (e: any) {
            console.error('[Drafts] Review items exception (Network?):', e.message || e);
            reviewData = [];
        }

        // 2. Fetch news_items
        try {
            const { data, error } = await supabase
                .from('news_items')
                .select('*')
                .eq('status', 'drafts_ready')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('[Drafts] News items fetch error:', error.message || error)
                newsData = []
            } else {
                newsData = (data as any) || []
            }
        } catch (e: any) {
            const isNetworkError = e.message?.includes('Failed to fetch') || e.name === 'TypeError';
            console.error('[Drafts] News items exception:', e.message || e);

            if (isNetworkError) {
                toast.error('Ошибка сети: не удалось подключиться к базе данных. Проверьте интернет или VPN.');
            } else {
                toast.error(`Ошибка загрузки: ${e.message || 'Unknown error'}`);
            }
            newsData = [];
        }

        // 3. Combine and sort
        const combined = [
            ...reviewData.map(item => ({
                ...item,
                display_date: item.created_at
            })),
            ...newsData.map(item => ({
                ...item,
                title_seed: item.title,
                is_news_item: true,
                display_date: item.approve1_decided_at || item.created_at
            }))
        ]

        combined.sort((a, b) => {
            const dateA = new Date(a.display_date || 0).getTime()
            const dateB = new Date(b.display_date || 0).getTime()
            return dateB - dateA
        })

        setDrafts(combined as any[])
        setLoading(false)
        setRefreshing(false)
    }, [supabase])

    const handlePlatformClick = useCallback((draft: DraftItem, platform: string) => {
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
    }, [])

    const handleAddPlatform = useCallback(async (draftId: string, platform: string): Promise<void> => {
        const draft = drafts.find(d => d.id === draftId)
        if (!draft) return

        const isNews = (draft as any).is_news_item

        // Генерируем контент для этой платформы
        let msgIndex = 0
        const toastId = toast.loading(LOADING_MESSAGES[0])

        // Interval to cycle messages
        const intervalId = setInterval(() => {
            msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length
            toast.loading(LOADING_MESSAGES[msgIndex], { id: toastId })
        }, 3000)

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

            clearInterval(intervalId)

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка генерации')
            }

            toast.success(`Контент для ${PLATFORM_CONFIG[platform]?.label} сгенерирован`, { id: toastId })

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
            clearInterval(intervalId)
            toast.error('Ошибка: ' + error.message, { id: toastId })
        }
    }, [drafts, fetchDrafts, handlePlatformClick])

    const handlePublish = useCallback(async (draft: DraftItem, scheduleDate?: string): Promise<void> => {
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
                await fetchDrafts() // Refresh list
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
    }, [fetchDrafts])

    // --- Effects ---

    const removeDraftOptimistically = useCallback((id: string) => {
        setDrafts(prev => prev.filter(d => d.id !== id))
    }, [])

    useEffect(() => {
        fetchActivePlatforms()
        fetchDrafts(true) // Initial load

        // 1. Subscribe to news_items changes
        const newsSubscription = supabase
            .channel('news_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'news_items', filter: 'status=eq.drafts_ready' },
                () => {
                    fetchDrafts()
                }
            )
            .subscribe()

        // 2. Subscribe to review_items changes
        const reviewSubscription = supabase
            .channel('review_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'review_items' },
                (payload: any) => {
                    // Refetch only if status is relevant
                    const status = payload.new?.status
                    const oldStatus = payload.old?.status
                    if (['needs_review', 'drafts_ready'].includes(status) || ['needs_review', 'drafts_ready'].includes(oldStatus)) {
                        fetchDrafts()
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(newsSubscription)
            supabase.removeChannel(reviewSubscription)
        }
    }, [supabase, fetchActivePlatforms, fetchDrafts])


    if (loading && drafts.length === 0) {
        return (
            <div className="p-6 space-y-6 h-full overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 pb-32">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <DraftSkeleton key={i} />
                    ))}
                </div>
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
            <div className="p-6 space-y-6 h-full overflow-y-auto relative">
                {refreshing && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50">
                        <div className="bg-card/90 backdrop-blur-md border border-border px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Обновление</span>
                        </div>
                    </div>
                )}
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 pb-32 transition-all duration-500 ${refreshing ? 'opacity-70 blur-[1px]' : ''}`}>
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
                    contentType={drafts.find(d => d.id === editingDraft)?.is_news_item ? 'news' : 'review'}
                    isOpen={!!editingDraft}
                    onClose={() => setEditingDraft(null)}
                    onSaved={fetchDrafts}
                    onOptimisticRemove={removeDraftOptimistically}
                />
            )}

            {/* Social Post Editor Dialog */}
            {editingPlatform && (
                <SocialPostEditorDialog
                    job={{
                        id: '', // New job
                        platform: editingPlatform.platform,
                        status: 'queued',
                        social_content: editingPlatform.content,
                        news_id: editingPlatform.isNews ? editingPlatform.draftId : null,
                        review_id: !editingPlatform.isNews ? editingPlatform.draftId : null,
                        publish_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        retry_count: 0,
                        news_items: editingPlatform.isNews ? drafts.find(d => d.id === editingPlatform.draftId) : null,
                        review_items: !editingPlatform.isNews ? drafts.find(d => d.id === editingPlatform.draftId) : null
                    } as any}
                    isOpen={!!editingPlatform}
                    onClose={() => setEditingPlatform(null)}
                    onUpdate={fetchDrafts}
                    onOptimisticRemove={removeDraftOptimistically}
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

function DraftSkeleton() {
    return (
        <div className="bg-card border border-border/40 rounded-xl overflow-hidden flex flex-col h-[400px] animate-pulse">
            <div className="w-full h-56 bg-muted/50" />
            <div className="p-7 space-y-4 flex-1">
                <div className="flex justify-between items-start gap-4">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-5 bg-muted rounded w-16" />
                </div>
                <div className="space-y-2 mt-auto">
                    <div className="flex gap-2">
                        <div className="h-8 bg-muted rounded-lg w-24" />
                        <div className="h-8 bg-muted rounded-lg w-24" />
                    </div>
                </div>
            </div>
        </div>
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
                "bg-card border border-border/60 rounded-xl overflow-hidden flex flex-col transition-all duration-300 group h-full relative cursor-pointer",
                "hover:shadow-xl hover:-translate-y-1 hover:border-border",
                "border-l-[4px] border-l-amber-500/80"
            )}
        >
            {/* Image Preview */}
            {draft.draft_image_file_id && (
                <div className="relative w-full h-48 overflow-hidden shrink-0 bg-muted/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`/api/telegram/photo/${draft.draft_image_file_id}`}
                        alt={draft.draft_title || draft.title_seed || 'Preview'}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                    {/* Hover Download Button */}
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg border-none"
                            onClick={(e) => {
                                e.stopPropagation();
                                const url = `/api/telegram/photo/${draft.draft_image_file_id}`;
                                const toastId = toast.loading('Подготовка JPG...');
                                downloadImageAsJpg(url, `draft_${draft.id}.jpg`)
                                    .then(() => toast.success('Сохранено', { id: toastId }))
                                    .catch(() => toast.error('Ошибка', { id: toastId }));
                            }}
                            title="Скачать JPG"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Floating Draft Badge */}
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/10 text-white/90 text-[10px] uppercase tracking-wider font-bold shadow-sm">
                        Черновик
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="p-5 flex flex-col flex-1 gap-4">
                <div className="space-y-2">
                    {/* Title */}
                    <h3 className="font-bold text-base leading-tight text-foreground/90 group-hover:text-primary transition-colors line-clamp-2 min-h-[2.5em]">
                        {draft.draft_title || draft.title_seed || 'Без названия'}
                    </h3>

                    {/* Date/Meta */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                        <CalendarDays className="w-3 h-3" />
                        <span>Создан: {draft.display_date ? format(new Date(draft.display_date), 'd MMM, HH:mm', { locale: ru }) : 'Неизвестно'}</span>
                    </div>
                </div>

                {/* Platforms Grid */}
                <div className="mt-auto">
                    {platformsWithContent.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            {platformsWithContent.map(platform => (
                                <PlatformChip
                                    key={platform}
                                    platform={platform}
                                    isMain={platform === 'site'}
                                    onClick={() => onPlatformClick(platform)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg border border-dashed border-border/60 bg-muted/20 text-center">
                            <span className="text-xs text-muted-foreground/70">Нет готовых платформ</span>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 mt-1 border-t border-border/40 flex items-center justify-between gap-2">
                    {/* Add Platform */}
                    {availablePlatforms.length > 0 ? (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1.5 rounded-full"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Добавить</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-1" align="start" side="top">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground/70 px-2 py-1.5 tracking-wider">
                                    Добавить платформу
                                </div>
                                <div className="grid gap-0.5">
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
                                                className="w-full flex items-center gap-2.5 px-2 py-2 text-sm rounded-md hover:bg-accent/50 text-left transition-colors"
                                            >
                                                <div className={cn("p-1.5 rounded-md flex items-center justify-center shrink-0", config.bgColor)}>
                                                    <Icon className={cn("w-3.5 h-3.5", config.color)} />
                                                </div>
                                                <span className="flex-1">{config.label}</span>
                                                <Sparkles className="w-3.5 h-3.5 text-emerald-500/70" />
                                            </button>
                                        )
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>
                    ) : (
                        <div className="text-[10px] text-muted-foreground/40 italic pl-1">Все платформы добавлены</div>
                    )}

                    {/* Publish Button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="ml-auto">
                                    <Button
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onPublish()
                                        }}
                                        className={cn(
                                            "h-8 rounded-full px-4 text-xs font-semibold shadow-sm transition-all",
                                            hasSite
                                                ? "bg-primary hover:bg-primary/90 hover:shadow-primary/20"
                                                : "bg-muted text-muted-foreground hover:bg-muted"
                                        )}
                                        disabled={!hasSite}
                                    >
                                        <Send className="w-3.5 h-3.5 mr-1.5" />
                                        Опубликовать
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            {!hasSite && (
                                <TooltipContent>
                                    <p>Сначала добавьте все площадки</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    )
}

function PlatformChip({ platform, isMain, onClick }: { platform: string, isMain?: boolean, onClick: () => void }) {
    const { icon: Icon, color, label, bgColor } = getPlatformConfig(platform)

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
                            "flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-md text-xs transition-all active:scale-95 group/chip w-full",
                            "hover:brightness-95 dark:hover:brightness-110",
                            isMain
                                ? "bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50"
                                : cn("border border-transparent bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground", bgColor) // customized per platform if needed, or just keep simple
                        )}
                    >
                        <div className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors",
                            isMain ? "bg-emerald-500/20" : cn("bg-muted/80 group-hover/chip:bg-background", bgColor)
                        )}>
                            <Icon className={cn("w-3.5 h-3.5", iconStyle)} />
                        </div>

                        <span className={cn("truncate font-medium flex-1 text-left", textStyle)}>
                            {label}
                        </span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                    <p>Редактировать <b>{label}</b>{isMain && ' (главная)'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
