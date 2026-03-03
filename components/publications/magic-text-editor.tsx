'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Wand2, Loader2, Check, RefreshCw, History as HistoryIcon } from 'lucide-react'
import { toast } from '@/components/ui/premium-toasts'
import { createClient } from '@/lib/supabase/client'
import { VoiceInput } from '@/components/ui/voice-input'

const EDIT_REQUEST_TIMEOUT_MS = 90_000

interface MagicTextEditorProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    originalText: string
    onSave: (newText: string) => void
    itemId?: string
    itemType?: 'news' | 'review'
    onHistoryUpdate?: (historyItem: { date: string; instruction: string; original_text_snippet: string }) => void
    initialHistory?: any[]
}

export function MagicTextEditor({ isOpen, onOpenChange, originalText, onSave, itemId, itemType, onHistoryUpdate, initialHistory = [] }: MagicTextEditorProps) {
    const [instruction, setInstruction] = useState('')
    const [generatedText, setGeneratedText] = useState('')
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState<any[]>(initialHistory)
    const [showHistory, setShowHistory] = useState(false)
    const [historyLoading, setHistoryLoading] = useState(false)
    const timersRef = useRef<NodeJS.Timeout[]>([])
    const toastIdRef = useRef<string | number | null>(null)
    const requestAbortRef = useRef<AbortController | null>(null)

    const clearProgressTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout)
        timersRef.current = []
    }, [])

    const dismissActiveToast = useCallback(() => {
        if (toastIdRef.current) {
            toast.dismiss(toastIdRef.current)
            toastIdRef.current = null
        }
    }, [])

    const abortInFlightRequest = useCallback((reason: string) => {
        if (requestAbortRef.current && !requestAbortRef.current.signal.aborted) {
            requestAbortRef.current.abort(reason)
        }
        requestAbortRef.current = null
    }, [])

    // Use the shared client
    const supabaseClient = useMemo(() => createClient(), [])

    // Display history effect
    useEffect(() => {
        if (!isOpen || !showHistory || !itemId || !itemType) return;

        const fetchHistory = async () => {
            setHistoryLoading(true)
            try {
                const table = itemType === 'news' ? 'news_items' : 'review_items'
                const { data } = await supabaseClient.from(table).select('correction_history').eq('id', itemId).single()
                if (data && data.correction_history) {
                    setHistory(data.correction_history as any[])
                }
            } catch (e) { console.error(e) }
            finally { setHistoryLoading(false) }
        }
        fetchHistory()
    }, [isOpen, showHistory, itemId, itemType, supabaseClient])

    // Cleanup effect
    useEffect(() => {
        return () => {
            clearProgressTimers()
            abortInFlightRequest('unmount')
            dismissActiveToast()
        }
    }, [abortInFlightRequest, clearProgressTimers, dismissActiveToast])

    useEffect(() => {
        if (isOpen) return
        clearProgressTimers()
        abortInFlightRequest('dialog_closed')
        dismissActiveToast()
        setLoading(false)
    }, [abortInFlightRequest, clearProgressTimers, dismissActiveToast, isOpen])


    const handleGenerate = async () => {
        if (!instruction) {
            toast.error('Введите инструкцию')
            return
        }

        clearProgressTimers()
        abortInFlightRequest('new_request')

        setLoading(true)
        const toastId = toast.loading('🚀 Запускаю AI редактор...')
        toastIdRef.current = toastId

        // Simulation timers
        const pushTimer = (msg: string, delay: number) => {
            timersRef.current.push(setTimeout(() => toast.loading(msg, { id: toastId }), delay))
        }

        pushTimer('🧠 Анализирую контекст...', 1000)
        pushTimer('✍️ Переписываю текст...', 2500)
        pushTimer('✨ Навожу лоск...', 4500)

        const controller = new AbortController()
        requestAbortRef.current = controller
        const timeoutId = setTimeout(() => controller.abort('timeout'), EDIT_REQUEST_TIMEOUT_MS)

        try {
            if (typeof supabaseClient.from !== 'function') {
                throw new Error(`Supabase initialization failed. Client type: ${typeof supabaseClient}`)
            }

            // Get API Key and Config from settings
            const { data: settings } = await supabaseClient
                .from('project_settings')
                .select('*')
                .eq('project_key', 'ainews')
                .in('key', ['ai_api_key', 'ai_base_url', 'ai_model', 'ai_provider', 'ai_proxy_url'])

            const config: any = {}
            settings?.forEach((s: any) => {
                if (s.key === 'ai_api_key') config.apiKey = s.value
                if (s.key === 'ai_base_url') config.baseUrl = s.value
                if (s.key === 'ai_model') config.model = s.value
                if (s.key === 'ai_provider') config.provider = s.value
                if (s.key === 'ai_proxy_url') config.proxyUrl = s.value
            })

            const res = await fetch('/api/ai/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    text: originalText,
                    instruction,
                    itemId,
                    itemType,
                    ...config
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Ошибка генерации')
            }

            const data = await res.json()
            clearProgressTimers()
            toast.success('Готово!', { id: toastId })
            toastIdRef.current = null
            setGeneratedText(data.result)

            // Optimistically update history
            if (itemId) {
                const newHistoryItem = {
                    date: new Date().toISOString(),
                    instruction,
                    original_text_snippet: originalText.substring(0, 100) + (originalText.length > 100 ? '...' : '')
                }
                setHistory(prev => [...prev, newHistoryItem])
                onHistoryUpdate?.(newHistoryItem)
            }
        } catch (e: any) {
            clearProgressTimers()
            console.error('Magic Edit Error:', e)

            const abortReason = controller.signal.aborted ? controller.signal.reason : null
            if (abortReason === 'dialog_closed' || abortReason === 'new_request' || abortReason === 'unmount') {
                toast.dismiss(toastId)
                toastIdRef.current = null
                return
            }

            const message = abortReason === 'timeout'
                ? `AI редактор не ответил за ${Math.round(EDIT_REQUEST_TIMEOUT_MS / 1000)} секунд. Попробуйте снова.`
                : `Error: ${e.message}`

            toast.error(message, { id: toastId })
            toastIdRef.current = null
        } finally {
            clearTimeout(timeoutId)
            if (requestAbortRef.current === controller) {
                requestAbortRef.current = null
            }
            setLoading(false)
        }
    }

    const handleApply = () => {
        onSave(generatedText)
        onOpenChange(false)
        setGeneratedText('')
        setInstruction('')
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl z-[100] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-500" />
                        AI Редактор
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Используйте AI для редактирования, перефразирования или изменения тона выбранного текста.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Оригинал</Label>
                        <div className="p-3 bg-muted/50 rounded-md text-sm border max-h-[150px] overflow-y-auto">
                            {originalText}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Инструкция для AI</Label>
                            <VoiceInput
                                onTranscription={(text) => setInstruction(prev => prev ? `${prev} ${text}` : text)}
                            />
                        </div>
                        <Textarea
                            placeholder="Например: Сделай текст более официальным, или сократи до 100 символов..."
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            className="bg-background"
                        />
                    </div>

                    {generatedText && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                            <Label className="text-purple-600 font-medium">Результат</Label>
                            <Textarea
                                value={generatedText}
                                onChange={(e) => setGeneratedText(e.target.value)}
                                className="border-purple-200 bg-purple-50/20 min-h-[300px] font-normal focus:ring-purple-500/20"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0 flex flex-col sm:flex-row justify-between items-center w-full">
                    {itemId && (
                        <div className="flex-1 flex justify-start w-full sm:w-auto mb-2 sm:mb-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowHistory(!showHistory)}
                                className="text-muted-foreground text-xs"
                            >
                                <HistoryIcon className="w-3 h-3 mr-1.5" />
                                {showHistory ? 'Скрыть историю' : 'История правок'}
                            </Button>
                        </div>
                    )}

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        {!generatedText ? (
                            <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
                                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                Генерировать
                            </Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    Переделать
                                </Button>
                                <Button onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-700">
                                    <Check className="w-4 h-4 mr-2" />
                                    Применить
                                </Button>
                            </>
                        )}
                    </div>
                </DialogFooter>

                {showHistory && (
                    <div className="border-t bg-muted/30 p-3 max-h-[150px] overflow-y-auto text-xs space-y-2">
                        <Label className="text-muted-foreground mb-2 block">История инструкций:</Label>
                        {historyLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" /> Загрузка...
                            </div>
                        ) : history.length === 0 ? (
                            <span className="text-muted-foreground italic">Истории пока нет</span>
                        ) : (
                            history.slice().reverse().map((h, i) => (
                                <div key={i} className="p-2 bg-background border rounded hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => setInstruction(h.instruction)}>
                                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                        <span>{new Date(h.date).toLocaleString('ru-RU')}</span>
                                    </div>
                                    <div className="font-medium line-clamp-2">{h.instruction}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
