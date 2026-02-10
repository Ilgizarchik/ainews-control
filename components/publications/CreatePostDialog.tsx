'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Image as ImageIcon, X } from 'lucide-react'
import { VoiceInput } from '@/components/ui/voice-input'

interface CreatePostDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function CreatePostDialog({ open, onOpenChange, onSuccess }: CreatePostDialogProps) {
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)

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
            const LOADING_MESSAGES = [
                "Думаю над заголовком...", "Пишу текст...", "Форматирую структуру...",
                "Добавляю креатива...", "Анализирую тренды...", "Подбираю лучшие формулировки...",
                "Почти готово...", "Еще немного магии..."
            ]

            let msgIndex = 0
            toast.loading("Запускаю AI генератор...", { id: toastId })

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
                    user_chat_id: 392453315
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
                        {/* Title Field */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="title" className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    📌 Название *
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
                                <Label htmlFor="description" className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    📝 Описание / Заметки
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
    )
}
