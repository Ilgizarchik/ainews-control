'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Wand2, Image as ImageIcon, Sparkles } from 'lucide-react'
import { VoiceInput } from '@/components/ui/voice-input'
import { toast } from 'sonner'
import { regenerateNewsImage, updateItemImage } from '@/app/actions/image-actions'
import { Upload } from 'lucide-react'
import { useRef } from 'react'
import { type DriveStep } from 'driver.js'

interface MediaTabProps {
    contentId: string
    contentType: 'news' | 'review'
    initialImageUrl?: string | null
    onUpdated: (newUrl: string, newPrompt: string) => void
    tutorialSteps?: DriveStep[]
}

export function MediaTab({ contentId, contentType, initialImageUrl, onUpdated, tutorialSteps: _tutorialSteps }: MediaTabProps) {
    const [adminNotes, setAdminNotes] = useState('')
    const [imageUrl, setImageUrl] = useState(initialImageUrl)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleRegenerate = async () => {
        setLoading(true)
        const toastId = toast.loading('🎨 Магия в процессе...')

        try {
            // We pass adminNotes as the "prompt" argument, but the server action will interpret it as context/instructions
            // if we update the server action logic. 
            // Actually, keep the interface consistent: we send the text.
            const result = await regenerateNewsImage(contentId, contentType, adminNotes)

            if (result.success && result.imageUrl) {
                setImageUrl(result.imageUrl)
                onUpdated(result.imageUrl, result.prompt || '')
                toast.success('Изображение обновлено', { id: toastId })
                // setAdminNotes('') // Clear notes after successful generation? Or keep? Let's keep for refinement. 
                // diverse user request: "поле ввода давай очистим" -> implied initial state.
            } else {
                toast.error(`Ошибка: ${result.error}`, { id: toastId })
            }
        } catch {
            toast.error('Ошибка при генерации', { id: toastId })
        } finally {
            setLoading(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        const toastId = toast.loading('📤 Загрузка изображения...')

        try {
            const formData = new FormData()
            formData.append('file', file)

            // 1. Upload to TG via our API route
            const uploadRes = await fetch('/api/upload-telegram', {
                method: 'POST',
                body: formData
            })

            const uploadData = await uploadRes.json()
            if (!uploadRes.ok || !uploadData.file_id) {
                throw new Error(uploadData.error || 'Failed to upload to Telegram')
            }

            const fileId = uploadData.file_id

            // 2. Update DB with file_id
            const dbResult = await updateItemImage(contentId, contentType, fileId)

            if (dbResult.success) {
                const proxyUrl = `/api/telegram/photo/${fileId}`
                setImageUrl(proxyUrl)
                onUpdated(proxyUrl, 'Загружено вручную')
                toast.success('Изображение успешно загружено', { id: toastId })
            } else {
                toast.error(`Ошибка БД: ${dbResult.error}`, { id: toastId })
            }
        } catch (error: any) {
            console.error('[handleFileUpload] Error:', error)
            toast.error(`Ошибка загрузки: ${error.message}`, { id: toastId })
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 p-1">
            {/* Left Panel: Prompt Controls - 40% width on Desktop */}
            <div className="flex flex-col gap-4 w-full lg:w-[40%] h-full">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-medium flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        Пожелания к иллюстрации
                    </Label>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">AI учтет это</span>
                        <VoiceInput
                            className="h-8 w-8 hover:bg-purple-50 hover:text-purple-600 border border-transparent hover:border-purple-100"
                            onTranscription={(text) => setAdminNotes(prev => prev ? `${prev} ${text}` : text)}
                        />
                    </div>
                </div>

                <div className="flex-1 relative group">
                    <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Например: 'Сделай акцент на красном цвете' или 'Добавь футуристичный город на фон'. Эти пожелания будут учтены при генерации."
                        className="h-full min-h-[200px] resize-none font-mono text-sm leading-relaxed bg-muted/20 focus:bg-background transition-colors p-4"
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={handleRegenerate}
                        disabled={loading || uploading}
                        className="flex-1 h-14 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Генерируем...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-5 h-5 mr-2" />
                                Сгенерировать
                            </>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || uploading}
                        className="w-14 h-14 shrink-0 border-2 border-dashed border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all group/upload"
                    >
                        {uploading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                        ) : (
                            <Upload className="w-5 h-5 text-purple-600 group-hover/upload:scale-110 transition-transform" />
                        )}
                    </Button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                    />
                </div>
            </div>

            {/* Right Panel: Image Preview - 60% width */}
            <div className="flex-1 h-full min-h-[300px] lg:min-h-0 bg-muted/10 rounded-xl border border-border/50 relative overflow-hidden group shadow-inner flex items-center justify-center">
                {/* Checkered background for transparency */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                {imageUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        {/* Wrapper for nice shadow/border around image */}
                        <div className="relative shadow-2xl rounded-lg overflow-hidden max-w-full max-h-full transition-transform duration-500 group-hover:scale-[1.02]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={imageUrl}
                                alt="Generated Content"
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>

                        {/* Overlay with info */}
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <Button size="sm" variant="secondary" className="shadow-md h-8 text-xs backdrop-blur-md bg-background/80 hover:bg-background" asChild>
                                <a href={imageUrl} target="_blank" rel="noopener noreferrer">Открыть оригинал</a>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                        <div className="w-24 h-24 rounded-full bg-muted/20 flex items-center justify-center">
                            <ImageIcon className="w-10 h-10" />
                        </div>
                        <p className="text-sm font-medium">Изображение отсутствует</p>
                    </div>
                )}

                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 transition-all duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                            <Loader2 className="w-12 h-12 animate-spin text-purple-600 relative z-10" />
                        </div>
                        <span className="mt-4 font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse">
                            Создаем магию...
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
