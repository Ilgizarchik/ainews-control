'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Wand2, Loader2, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@supabase/supabase-js'
import { VoiceInput } from '@/components/ui/voice-input'

interface MagicTextEditorProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    originalText: string
    onSave: (newText: string) => void
}

export function MagicTextEditor({ isOpen, onOpenChange, originalText, onSave }: MagicTextEditorProps) {
    const [instruction, setInstruction] = useState('')
    const [generatedText, setGeneratedText] = useState('')
    const [loading, setLoading] = useState(false)

    // Direct initialization with vanilla client
    const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleGenerate = async () => {
        if (!instruction) {
            toast.error('Введите инструкцию')
            return
        }

        setLoading(true)
        console.log('Init Supabase Client:', supabaseClient)

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
                body: JSON.stringify({
                    text: originalText,
                    instruction,
                    ...config
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Ошибка генерации')
            }

            const data = await res.json()
            setGeneratedText(data.result)
        } catch (e: any) {
            console.error('Magic Edit Error:', e)
            toast.error(`Error: ${e.message}`)
        } finally {
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
                                className="border-purple-200 bg-purple-50/20 min-h-[300px] font-normal"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {!generatedText ? (
                        <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                            Генерировать
                        </Button>
                    ) : (
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Переделать
                            </Button>
                            <Button onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-700">
                                <Check className="w-4 h-4 mr-2" />
                                Применить
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
