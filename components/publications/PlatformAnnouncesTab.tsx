'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles, Copy, Check } from 'lucide-react'
import { PLATFORM_CONFIG } from '@/lib/platform-config'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { showSuccessToast } from '@/components/ui/premium-toasts'
import { logSystemEvent, SOCIAL_GEN_PHRASES, getRandomPhrase } from '@/lib/logger-client'
import { type DriveStep } from 'driver.js'

type PlatformAnnouncesTabProps = {
    contentId: string
    contentType?: 'news' | 'review'
    baseAnnounce: string
    longread?: string
    announces: Record<string, string>
    onChange: (platform: string, value: string) => void
    onAnnouncesGenerated?: (newAnnounces: Record<string, string>) => void
    tutorialSteps?: DriveStep[]
}

const PLATFORMS = ['site', 'tg', 'vk', 'ok', 'fb', 'x', 'threads']

const LOADING_MESSAGES = [
    "Готовлю для тебя контент, подожди пожалуйста... 🍳",
    "Прогреваю нейросети... 🔥",
    "Потерпи пожалуйста, скоро будет готово... ⏳",
    "Разгоняю цифровые нейроны... 🧠",
    "Договариваюсь с музой... 🧚‍♀️",
    "Фух, я почти закончил, наношу последние штрихи... 🎨",
    "Еще чуть-чуть, магия требует времени... ✨"
]

import { getSystemPrompt, updateSystemPrompt } from '@/app/actions/prompts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Send } from 'lucide-react'
import { publishSinglePlatform } from '@/app/actions/publish-actions'

export function PlatformAnnouncesTab({
    contentId,
    contentType = 'review',
    baseAnnounce,
    longread,
    announces,
    onChange,
    onAnnouncesGenerated,
    tutorialSteps: _tutorialSteps
}: PlatformAnnouncesTabProps) {
    const [generating, setGenerating] = useState(false)
    const [publishing, setPublishing] = useState<string | null>(null)
    const [publishResult, setPublishResult] = useState<any>(null)
    const [copied, setCopied] = useState<string | null>(null)
    const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
    const [activePlatformKeys, setActivePlatformKeys] = useState<string[] | null>(null)

    // Fetch active platforms from recipes
    useEffect(() => {
        const fetchActivePlatforms = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('publish_recipes')
                .select('platform, is_active')
                .eq('is_active', true)

            if (!error && data) {
                const keys = data.map(r => r.platform.toLowerCase())
                // Always include 'site' if not present, as it's the core platform
                if (!keys.includes('site')) keys.push('site')
                setActivePlatformKeys(keys)
            } else {
                // Fallback to all if error
                setActivePlatformKeys(PLATFORMS)
            }
        }
        fetchActivePlatforms()
    }, [])

    // Filter platforms to display
    const visiblePlatforms = PLATFORMS.filter(p => activePlatformKeys?.includes(p))

    // Cycle update messages
    useEffect(() => {
        if (!generating) {
            setLoadingMsgIndex(0)
            return
        }

        const interval = setInterval(() => {
            setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
        }, 3000)

        return () => clearInterval(interval)
    }, [generating])

    // Prompt Editor State
    const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
    const [promptContent, setPromptContent] = useState('')
    const [loadingPrompt, setLoadingPrompt] = useState(false)
    const [savingPrompt, setSavingPrompt] = useState(false)

    const handleTestPublish = async (platform: string) => {
        const content = announces[platform]
        if (!content) {
            toast.error('Сначала сгенерируйте контент')
            return
        }

        setPublishing(platform)
        try {
            const result = await publishSinglePlatform({
                itemId: contentId,
                itemType: contentType,
                platform,
                content,
                bypassSafeMode: true,
                isTest: true
            })
            setPublishResult({ ...result, platform })
        } catch (error: any) {
            setPublishResult({
                platform,
                success: false,
                error: error.message
            })
        } finally {
            setPublishing(null)
        }
    }

    const openPromptEditor = async (platform: string) => {
        setEditingPrompt(platform)
        setLoadingPrompt(true)
        setPromptContent('')

        try {
            // Handle special case for Telegram emoji step
            const key = platform === 'tg_emoji'
                ? 'rewrite_social_tg_emoji'
                : `rewrite_social_${platform}`

            console.log(`[PlatformAnnouncesTab] Opening prompt editor for key: ${key}`)
            const data = await getSystemPrompt(key)
            console.log(`[PlatformAnnouncesTab] Received data:`, data)

            if (data?.content) {
                setPromptContent(data.content)
            } else {
                toast.error('Промпт не найден')
                setEditingPrompt(null)
            }
        } catch (e: any) {
            toast.error('Ошибка загрузки промпта')
            console.error(e)
            setEditingPrompt(null)
        } finally {
            setLoadingPrompt(false)
        }
    }

    const handleCopy = async (platform: string) => {
        await navigator.clipboard.writeText(announces[platform] || '')
        setCopied(platform)
        showSuccessToast('Скопировано в буфер обмена')
        setTimeout(() => setCopied(null), 2000)
    }

    const savePrompt = async () => {
        if (!editingPrompt) return
        setSavingPrompt(true)
        try {
            // Handle special case for Telegram emoji step
            const key = editingPrompt === 'tg_emoji'
                ? 'rewrite_social_tg_emoji'
                : `rewrite_social_${editingPrompt}`
            await updateSystemPrompt(key, promptContent)
            showSuccessToast('Промпт обновлен')
            setEditingPrompt(null)
        } catch (e: any) {
            toast.error('Ошибка сохранения: ' + e.message)
        } finally {
            setSavingPrompt(false)
        }
    }

    const handleGenerate = async (selectedPlatforms?: string[]) => {
        // Allow generation if we have either baseAnnounce OR longread (for site)
        const hasSource = baseAnnounce || (longread && longread.length > 0)

        if (!hasSource) {
            toast.error('Сначала заполните основной анонс или полный текст статьи')
            return
        }

        let platformsToGenerate = selectedPlatforms

        // Smart generation logic: if no specific platforms selected (clicked "Generate All")
        if (!platformsToGenerate) {
            const missing = visiblePlatforms.filter(p => !announces[p] || announces[p].trim() === '')

            if (missing.length > 0) {
                // If we have empty fields, only generate for them
                platformsToGenerate = missing
                toast.info(`Генерируем недостающие: ${missing.map(p => PLATFORM_CONFIG[p]?.label || p).join(', ')}`)
            } else {
                // If all filled, regenerate everything
                platformsToGenerate = visiblePlatforms
                toast.info('Перегенерируем все анонсы...')
            }
        }

        setGenerating(true)
        logSystemEvent(getRandomPhrase(SOCIAL_GEN_PHRASES), 'thinking')

        try {
            const response = await fetch('/api/ai/generate-platform-announces', {
                method: 'POST',
                keepalive: true, // Allow request to complete even if tab closed
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    review_id: contentType === 'review' ? contentId : undefined,
                    news_id: contentType === 'news' ? contentId : undefined,
                    platforms: platformsToGenerate
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка генерации')
            }

            if (onAnnouncesGenerated) {
                onAnnouncesGenerated(result.results)
            } else {
                Object.entries(result.results).forEach(([platform, content]) => {
                    onChange(platform, content as string)
                })
            }

            showSuccessToast(`Сгенерировано анонсов: ${Object.keys(result.results).length}`)
            logSystemEvent(`Готово! Сгенерировано анонсов: ${Object.keys(result.results).length}`, 'success')
        } catch (error: any) {
            toast.error('Ошибка: ' + error.message)
            logSystemEvent(`Ошибка генерации: ${error.message}`, 'error')
        } finally {
            setGenerating(false)
        }
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className="space-y-4 h-full flex flex-col">
                <div data-tutorial="platforms-header" className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-base font-semibold">Адаптация под соцсети</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            AI адаптирует текст под формат и аудиторию каждой платформы
                        </p>
                    </div>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                data-tutorial="generate-all-button"
                                onClick={() => handleGenerate(visiblePlatforms)}
                                disabled={generating || (!baseAnnounce && !longread) || !activePlatformKeys}
                                className="gap-2"
                            >
                                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {generating ? 'Генерация...' : 'Сгенерировать всё'}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                            <p className="font-semibold mb-1">Автоматическая адаптация</p>
                            <p className="text-xs text-muted-foreground">
                                Создаёт тексты для всех активных платформ одновременно, учитывая особенности каждой соцсети
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div data-tutorial="platforms-list" className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {!activePlatformKeys ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
                        </div>
                    ) : visiblePlatforms.map(platform => {
                        const config = PLATFORM_CONFIG[platform]
                        const Icon = config?.icon
                        const isEmpty = !announces[platform]

                        // Platform specific styling
                        let cardStyle = "border-border bg-card"
                        let headerStyle = "text-muted-foreground"
                        if (platform === 'tg') {
                            cardStyle = "border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10"
                            headerStyle = "text-blue-600 dark:text-blue-400"
                        } else if (platform === 'vk') {
                            cardStyle = "border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10"
                            headerStyle = "text-indigo-600 dark:text-indigo-400"
                        } else if (platform === 'ok') {
                            cardStyle = "border-orange-100 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-900/10"
                            headerStyle = "text-orange-600 dark:text-orange-400"
                        } else if (platform === 'site') {
                            cardStyle = "border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10"
                            headerStyle = "text-emerald-600 dark:text-emerald-400"
                        }

                        return (
                            <div
                                key={platform}
                                data-tutorial={platform === 'tg' ? 'platform-card-tg' : undefined}
                                className={cn(
                                    "border rounded-xl p-4 transition-all duration-300 hover:shadow-md",
                                    cardStyle
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-lg bg-background shadow-sm border border-border/50", headerStyle)}>
                                            {Icon && <Icon className="w-5 h-5" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <Label className="font-bold text-base cursor-pointer">{config?.label || platform}</Label>
                                                {platform === 'tg' && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-600 text-white shadow-sm cursor-help">
                                                                2 step
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <p className="text-xs">
                                                                <span className="font-semibold">Двухэтапная генерация:</span> сначала базовый текст, затем добавление эмодзи для Telegram
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {platform === 'site' && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm cursor-help">
                                                                SEO
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <p className="text-xs">
                                                                <span className="font-semibold">SEO-оптимизация:</span> текст адаптирован для поисковых систем с учётом ключевых слов
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!isEmpty && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCopy(platform)}
                                                        className="h-8 w-8 p-0 rounded-full hover:bg-background/80"
                                                    >
                                                        {copied === platform ? (
                                                            <Check className="w-4 h-4 text-green-600" />
                                                        ) : (
                                                            <Copy className="w-4 h-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <p className="text-xs">Скопировать текст в буфер обмена</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        <div data-tutorial="platform-actions">
                                            {platform === 'tg' ? (
                                                <>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openPromptEditor('tg')}
                                                                className="h-8 w-8 p-0 rounded-full hover:bg-background/80"
                                                            >
                                                                <div className="flex items-center justify-center w-full h-full text-muted-foreground hover:text-foreground">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                                                </div>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <p className="font-semibold mb-1">Редактировать промпт</p>
                                                            <p className="text-xs text-muted-foreground">Шаг 1: Настройка базового текста для Telegram</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openPromptEditor(`${platform}_emoji`)}
                                                                className="h-8 w-8 p-0 rounded-full hover:bg-background/80 border-blue-300 dark:border-blue-700"
                                                            >
                                                                <div className="flex items-center justify-center w-full h-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                                                </div>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <p className="font-semibold mb-1">Редактировать промпт эмодзи</p>
                                                            <p className="text-xs text-muted-foreground">Шаг 2: Настройка добавления эмодзи в текст</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </>
                                            ) : (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openPromptEditor(platform)}
                                                            className="h-8 w-8 p-0 rounded-full hover:bg-background/80"
                                                        >
                                                            <div className="flex items-center justify-center w-full h-full text-muted-foreground hover:text-foreground">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                                            </div>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs">
                                                        <p className="font-semibold mb-1">Редактировать промпт</p>
                                                        <p className="text-xs text-muted-foreground">Настройте инструкции для AI генерации текста</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleTestPublish(platform)}
                                                        disabled={publishing === platform || !announces[platform]}
                                                        className={cn(
                                                            "h-8 gap-1.5 bg-background shadow-sm hover:bg-accent border-border/60 text-xs font-medium",
                                                            publishing === platform ? "animate-pulse" : ""
                                                        )}
                                                    >
                                                        {publishing === platform ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Send className="w-3.5 h-3.5" />
                                                        )}
                                                        <span className="hidden sm:inline">Тест</span>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs">
                                                    <p className="font-semibold mb-1">Тестовая публикация</p>
                                                    <p className="text-xs text-muted-foreground">Опубликовать текст на платформе для проверки</p>
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleGenerate([platform])}
                                                        disabled={generating || (!baseAnnounce && !longread)}
                                                        className="h-8 gap-1.5 bg-background shadow-sm hover:bg-accent border-border/60 text-xs font-medium"
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">AI</span>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs">
                                                    <p className="font-semibold mb-1">Сгенерировать с AI</p>
                                                    <p className="text-xs text-muted-foreground">Создать текст для этой платформы с помощью искусственного интеллекта</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </div>
                                <Textarea
                                    value={announces[platform] || ''}
                                    onChange={(e) => onChange(platform, e.target.value)}
                                    placeholder={
                                        platform === 'site'
                                            ? `Напишите текст для ${config?.label || platform}...\n\n💡 Совет: Этот текст будет основой для всех остальных площадок`
                                            : `Напишите текст для ${config?.label || platform}...`
                                    }
                                    className={cn(
                                        "min-h-[120px] text-sm resize-y bg-background/50 focus:bg-background transition-colors border-0 ring-1 ring-border/50 focus:ring-2 focus:ring-primary/20",
                                        "placeholder:text-muted-foreground/40 font-normal leading-relaxed custom-scrollbar"
                                    )}
                                />

                                <div className="mt-2 flex flex-col gap-1 px-1">
                                    <div className="flex justify-between items-center">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider cursor-help">
                                                    {platform === 'tg' ? 'Поддерживает форматирование' : 'Простой текст'}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs">
                                                {platform === 'tg' ? (
                                                    <>
                                                        <p className="font-semibold mb-1">Markdown форматирование</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Можно использовать **жирный**, *курсив*, [ссылки](url) и другие элементы разметки
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="font-semibold mb-1">Обычный текст</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Текст без специального форматирования, как есть
                                                        </p>
                                                    </>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                        {announces[platform] && (
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                <span className={cn(
                                                    announces[platform].length > (config?.maxLength || 4000) ? "text-red-500" : ""
                                                )}>
                                                    {announces[platform].length}
                                                </span>
                                                <span className="opacity-50">/ {config?.maxLength || '∞'}</span>
                                            </div>
                                        )}
                                    </div>

                                    {platform === 'tg' && (announces[platform]?.length || 0) > 1100 && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-500/80 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>Пост будет разделен: сначала фото, затем текст (лимит 1024 симв.)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <AnimatePresence mode="wait">
                    {generating && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-sm"
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    <motion.div
                                        className="absolute inset-0 bg-primary/20 rounded-full blur-md"
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <motion.p
                                        key={loadingMsgIndex}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        className="text-sm font-medium text-foreground/80"
                                    >
                                        {LOADING_MESSAGES[loadingMsgIndex]}
                                    </motion.p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Prompt Editor Dialog - placed outside the scrollable area */}
                <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && setEditingPrompt(null)}>
                    <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>
                                Редактирование промпта: {editingPrompt === 'tg_emoji' ? 'Telegram (Шаг 2: Эмодзи)' : editingPrompt}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Настройка системных инструкций для генерации текста под конкретную социальную сеть.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 min-h-0 py-4">
                            {loadingPrompt ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <Textarea
                                    value={promptContent}
                                    onChange={(e) => setPromptContent(e.target.value)}
                                    className="h-full font-mono text-sm resize-none"
                                    placeholder="Введите системный промпт..."
                                />
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingPrompt(null)}>Отмена</Button>
                            <Button onClick={savePrompt} disabled={savingPrompt || loadingPrompt}>
                                {savingPrompt && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Test Result Dialog */}
                <Dialog open={!!publishResult} onOpenChange={(open) => !open && setPublishResult(null)}>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <div className="flex items-center gap-2">
                                {publishResult?.success ? (
                                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                                        <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </div>
                                ) : (
                                    <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    </div>
                                )}
                                <DialogTitle>
                                    {publishResult?.success ? 'Результат теста' : 'Ошибка публикации'}
                                </DialogTitle>
                            </div>
                            <DialogDescription>
                                Платформа: <b className="uppercase">{publishResult?.platform}</b>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {publishResult?.simulated && (
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex gap-2">
                                    <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                                    <div>
                                        <b>Режим симуляции (Safe Mode) активен.</b> Реальной публикации не произошло.
                                    </div>
                                </div>
                            )}

                            {/* Quick Info Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl border bg-muted/30">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Статус</Label>
                                    <div className="flex items-center gap-1.5 font-medium text-sm">
                                        {publishResult?.success ? (
                                            <><div className="w-2 h-2 rounded-full bg-green-500" /> Успешно</>
                                        ) : (
                                            <><div className="w-2 h-2 rounded-full bg-red-500" /> Ошибка</>
                                        )}
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl border bg-muted/30">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">ID Публикации</Label>
                                    <div className="font-mono text-sm truncate" title={publishResult?.external_id || 'N/A'}>
                                        {publishResult?.external_id || '—'}
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="space-y-3">
                                {publishResult?.published_url && (
                                    <div className="p-4 rounded-xl bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30">
                                        <Label className="text-[10px] uppercase font-bold text-green-700 dark:text-green-400 block mb-2 leading-none">Прямая ссылка на пост:</Label>
                                        <div className="flex items-center gap-2 group">
                                            <a
                                                href={publishResult.published_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-primary hover:underline break-all font-mono text-xs flex-1"
                                            >
                                                {publishResult.published_url}
                                            </a>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(publishResult.published_url)
                                                    showSuccessToast('Ссылка скопирована')
                                                }}
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="relative group">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Технические данные (JSON):</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                navigator.clipboard.writeText(JSON.stringify(publishResult, null, 2))
                                                showSuccessToast('JSON скопирован')
                                            }}
                                        >
                                            <Copy className="w-3 h-3 mr-1" /> Копировать
                                        </Button>
                                    </div>
                                    <div className="rounded-xl border bg-black/5 dark:bg-white/5 overflow-hidden">
                                        <pre className="p-4 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[250px] custom-scrollbar text-foreground/80 whitespace-pre-wrap break-all">
                                            {JSON.stringify(publishResult, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button onClick={() => setPublishResult(null)}>Закрыть</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    )
}
