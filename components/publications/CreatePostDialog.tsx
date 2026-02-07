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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title) return

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
            toast.loading('Генерирую пост с помощью AI...', { id: 'generate' })

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
            toast.success(`Пост успешно создан! ID: ${result.review_id}`, { id: 'generate' })

            // Reset form
            setTitle('')
            setDescription('')
            setImageFile(null)
            onOpenChange(false)
            onSuccess?.()

        } catch (error: any) {
            console.error('Error creating post:', error)
            toast.error(error.message || 'Ошибка создания поста', { id: 'generate' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader data-tutorial="create-post-header">
                    <DialogTitle>Создать новую публикацию</DialogTitle>
                    <DialogDescription>
                        AI создаст полный пост: заголовок, анонс и подробный лонгрид.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="title">Название *</Label>
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
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="description">Описание / Заметки</Label>
                            <VoiceInput
                                onTranscription={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                            />
                        </div>
                        <Textarea
                            data-tutorial="create-post-description"
                            id="description"
                            placeholder="Краткое описание, особенности, характеристики, цена, впечатления..."
                            className="min-h-[150px]"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div data-tutorial="create-post-photo" className="space-y-2">
                        <Label>Фото</Label>
                        {imageFile ? (
                            <div className="flex items-center justify-between p-2 border rounded-md">
                                <span className="text-sm truncate max-w-[400px]">{imageFile.name}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setImageFile(null)}
                                    disabled={loading}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
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
                                    className="w-full border-dashed"
                                    disabled={loading}
                                >
                                    <ImageIcon className="w-4 h-4 mr-2" />
                                    Выберите фото
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button data-tutorial="create-post-submit" type="submit" disabled={loading || !title}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Создать пост
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
