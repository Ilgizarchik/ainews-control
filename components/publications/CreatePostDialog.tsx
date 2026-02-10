'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Image as ImageIcon, X, Globe, Zap, Settings2, Sparkles, Check } from 'lucide-react'
import { VoiceInput } from '@/components/ui/voice-input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getSystemPrompt, updateSystemPrompt } from '@/app/actions/prompts'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CreatePostDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function CreatePostDialog({ open, onOpenChange, onSuccess }: CreatePostDialogProps) {
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [useWebSearch, setUseWebSearch] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // Prompt Editor State
    const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null)
    const [promptContent, setPromptContent] = useState('')
    const [loadingPrompt, setLoadingPrompt] = useState(false)
    const [savingPrompt, setSavingPrompt] = useState(false)

    const handleEditPrompt = async (key: string) => {
        setEditingPromptKey(key)
        setLoadingPrompt(true)
        try {
            const data = await getSystemPrompt(key)
            setPromptContent(data?.content || '')
        } catch (e) {
            toast.error('Ошибка загрузки промпта')
        } finally {
            setLoadingPrompt(false)
        }
    }

    const handleSavePrompt = async () => {
        if (!editingPromptKey) return
        setSavingPrompt(true)
        try {
            await updateSystemPrompt(editingPromptKey, promptContent)
            toast.success('Промпт сохранен')
            setEditingPromptKey(null)
        } catch (e: any) {
            toast.error('Ошибка сохранения: ' + e.message)
        } finally {
            setSavingPrompt(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title) return

        let intervalId: NodeJS.Timeout | undefined
        // toastId we can just use string 'generate' which is constant.
        const toastId = 'generate'

        try {
            setLoading(true)
            let fileId = null

            // 1. Upload image to Telegram if selected
            if (imageFile) {
                toast.loading('Загружаю изображение...', { id: 'upload' })
                const formData = new FormData()
                formData.append('file', imageFile)

                const uploadRes = await fetch('/api/upload-telegram', {
                    method: 'POST',
                    body: formData
                })

                if (!uploadRes.ok) {
                    const errData = await uploadRes.json()
                    throw new Error(errData.error || 'Ошибка загрузки изображения')
                }

                const data = await uploadRes.json()
                fileId = data.file_id
                toast.success('Изображение загружено', { id: 'upload' })
            }

            // 2. Generate post via AI
            const LOADING_MESSAGES = useWebSearch ? [
                "Ищу информацию в интернете...", "Анализирую источники...", "Сопоставляю факты...",
                "Пишу черновик...", "Форматирую структуру...", "Добавляю детали из поиска...",
                "Почти готово...", "Еще немного магии..."
            ] : [
                "Думаю над заголовком...", "Пишу текст...", "Форматирую структуру...",
                "Добавляю креатива...", "Анализирую тренды...", "Подбираю лучшие формулировки...",
                "Почти готово...", "Еще немного магии..."
            ]

            let msgIndex = 0
            toast.loading(useWebSearch ? "Запускаю поиск и генерацию..." : "Запускаю AI генератор...", { id: toastId })

            // Cycle messages
            intervalId = setInterval(() => {
                msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length
                toast.loading(LOADING_MESSAGES[msgIndex], { id: toastId })
            }, 2500)

            const factpack = {
                description: description || undefined
            }

            const generateRes = await fetch('/api/ai/generate-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title_seed: title,
                    factpack: factpack,
                    draft_image_file_id: fileId,
                    user_chat_id: 392453315,
                    web_search: useWebSearch
                })
            })

            if (!generateRes.ok) {
                const errData = await generateRes.json()
                throw new Error(errData.error || 'Ошибка генерации поста')
            }

            const result = await generateRes.json()
            toast.success(`Пост успешно создан! ID: ${result.review_id}`, { id: toastId })

            // Reset form
            setTitle('')
            setDescription('')
            setImageFile(null)
            setUseWebSearch(false)
            onOpenChange(false)
            onSuccess?.()

        } catch (error: any) {
            console.error('Error creating post:', error)
            toast.error(error.message || 'Ошибка создания поста', { id: toastId })
        } finally {
            clearInterval(intervalId)
            setLoading(false)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-2 border-border/50 shadow-2xl rounded-3xl bg-background">
                    {/* Premium Header */}
                    <DialogHeader data-tutorial="create-post-header" className="px-8 py-6 border-b-2 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 shrink-0">
                        <DialogTitle className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                            Создать новую публикацию
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground/70 font-bold mt-1">
                            AI создаст полный пост: заголовок, анонс и подробный лонгрид.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-8 py-8 bg-background/50">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Web Search Toggle */}
                            <div className={cn(
                                "p-4 rounded-2xl border-2 transition-all duration-500 flex items-center justify-between gap-4",
                                useWebSearch
                                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                                    : "bg-muted/30 border-transparent hover:border-border"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
                                        useWebSearch ? "bg-emerald-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                                    )}>
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold flex items-center gap-1.5">
                                            Глубокий поиск в интернете
                                            {useWebSearch && <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-medium">
                                            Агент найдет свежие факты, цены и детали в Chrome перед написанием
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={useWebSearch}
                                    onCheckedChange={setUseWebSearch}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                            </div>

                            {/* Title Field */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="title" className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        📌 Название *
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditPrompt('review_title')}
                                                        className="h-6 w-6 p-0 rounded-full hover:bg-muted text-muted-foreground transition-all"
                                                    >
                                                        <Settings2 className="w-3 h-3" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-tight">Настроить промпт заголовка</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </Label>
                                    <VoiceInput
                                        onTranscription={(text) => setTitle(prev => prev ? `${prev} ${text}` : text)}
                                    />
                                </div>
                                <Input
                                    data-tutorial="create-post-title"
                                    id="title"
                                    placeholder="Например: Нож Mora Companion Heavy Duty"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    disabled={loading}
                                    className="h-14 text-lg font-bold rounded-2xl border-2 px-5 shadow-sm focus-visible:ring-emerald-500 transition-all bg-background"
                                    required
                                />
                            </div>

                            {/* Description Field */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="description" className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-3">
                                        📝 Описание / Заметки
                                        <div className="flex items-center gap-1.5 ml-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEditPrompt('review_longread')}
                                                            className="h-6 w-6 p-0 rounded-full hover:bg-muted text-muted-foreground transition-all"
                                                        >
                                                            <Settings2 className="w-3 h-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-tight">Промпт статьи (Longread)</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEditPrompt('review_announce')}
                                                            className="h-6 w-6 p-0 rounded-full hover:bg-muted text-muted-foreground transition-all"
                                                        >
                                                            <Sparkles className="w-3 h-3 text-emerald-500" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-tight">Промпт анонса</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </Label>
                                    <VoiceInput
                                        onTranscription={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                                    />
                                </div>
                                <Textarea
                                    data-tutorial="create-post-description"
                                    id="description"
                                    placeholder="Краткое описание, особенности, характеристики, цена, впечатления..."
                                    className="min-h-[160px] text-base font-medium rounded-2xl border-2 p-5 shadow-sm focus-visible:ring-emerald-500 transition-all bg-background leading-relaxed"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            {/* Photo Field */}
                            <div data-tutorial="create-post-photo" className="space-y-3">
                                <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    🖼️ Фото
                                </Label>
                                {imageFile ? (
                                    <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <ImageIcon className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm font-bold truncate max-w-[300px] text-emerald-800 dark:text-emerald-200">
                                                {imageFile.name}
                                            </span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setImageFile(null)}
                                            disabled={loading}
                                            className="h-10 w-10 text-rose-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-xl"
                                        >
                                            <X className="w-5 h-5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div
                                        className={`group relative transition-all duration-300 ${isDragging ? 'scale-[1.02]' : ''}`}
                                        onDragOver={(e) => {
                                            e.preventDefault()
                                            setIsDragging(true)
                                        }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            setIsDragging(false)
                                            const file = e.dataTransfer.files?.[0]
                                            if (file && file.type.startsWith('image/')) {
                                                setImageFile(file)
                                            } else if (file) {
                                                toast.error('Пожалуйста, выберите изображение')
                                            }
                                        }}
                                    >
                                        <Input
                                            id="imageFile"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    setImageFile(e.target.files[0])
                                                }
                                            }}
                                            disabled={loading}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById('imageFile')?.click()}
                                            className={`w-full h-24 border-dashed border-2 rounded-2xl flex flex-col gap-2 transition-all duration-300 ${isDragging
                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                                                : 'hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/10 hover:text-emerald-600'
                                                }`}
                                            disabled={loading}
                                        >
                                            <ImageIcon className={`w-6 h-6 mb-1 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />
                                            <span className="font-bold text-sm">Выберите фото для публикации</span>
                                            <span className="text-[10px] uppercase font-black tracking-widest opacity-40 group-hover:opacity-100">или просто перетащите сюда</span>
                                        </Button>
                                        {isDragging && (
                                            <div className="absolute inset-0 z-10 pointer-events-none border-2 border-emerald-500 border-dashed rounded-2xl animate-pulse" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Premium Footer */}
                    <div className="px-8 py-6 border-t-2 bg-muted/10 shrink-0 flex items-center justify-end">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-12 px-8 rounded-xl font-bold mr-4">
                            Отмена
                        </Button>
                        <Button
                            data-tutorial="create-post-submit"
                            type="submit"
                            onClick={(e) => handleSubmit(e as any)}
                            disabled={loading || !title}
                            className="h-12 px-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <span className="mr-2">🚀</span>
                            )}
                            Создать пост
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Prompt Editor Dialog */}
            <Dialog open={!!editingPromptKey} onOpenChange={(open) => !open && setEditingPromptKey(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col rounded-3xl border-2 shadow-2xl bg-background outline-none">
                    <DialogHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
                        <DialogTitle className="text-xl font-black flex items-center gap-2 text-foreground">
                            <Settings2 className="w-5 h-5 text-emerald-500" />
                            Редактирование промпта: <span className="text-emerald-600 ml-1">{editingPromptKey}</span>
                        </DialogTitle>
                        <DialogDescription className="sr-only">Настройка системного промпта для генерации контента через AI</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 py-6 px-6 bg-background">
                        {loadingPrompt ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground gap-3">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <span className="font-bold uppercase tracking-widest text-sm">Загружаю инструкции...</span>
                            </div>
                        ) : (
                            <Textarea
                                value={promptContent}
                                onChange={(e) => setPromptContent(e.target.value)}
                                className="h-full font-mono text-sm resize-none border-2 rounded-2xl p-6 focus-visible:ring-emerald-500 bg-background leading-relaxed transition-all shadow-inner"
                                placeholder="Введите системный промпт..."
                            />
                        )}
                    </div>
                    <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0">
                        <Button variant="outline" onClick={() => setEditingPromptKey(null)} className="h-11 rounded-xl px-6 font-bold mr-2">Отмена</Button>
                        <Button onClick={handleSavePrompt} disabled={savingPrompt || loadingPrompt} className="h-11 rounded-xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xl shadow-emerald-500/20 transition-all active:scale-95">
                            {savingPrompt ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Сохранить промпт
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
