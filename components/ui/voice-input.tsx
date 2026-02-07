'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface VoiceInputProps {
    onTranscription: (text: string) => void
    isListening?: boolean
    className?: string
}

export function VoiceInput({ onTranscription, className }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false)
    const [recognition, setRecognition] = useState<any>(null)
    const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown')


    // Use ref to avoid re-creating the recognition instance when onTranscription changes
    const onTranscriptionRef = useRef(onTranscription)

    useEffect(() => {
        onTranscriptionRef.current = onTranscription
    }, [onTranscription])

    useEffect(() => {
        // Check initial permission state
        if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'microphone' as any })
                .then((permissionStatus) => {
                    setPermissionState(permissionStatus.state)
                    permissionStatus.onchange = () => {
                        setPermissionState(permissionStatus.state)
                    }
                })
                .catch(() => {
                    // Firefox or unsupported browsers might fail
                    setPermissionState('unknown')
                })
        }
    }, [])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            if (SpeechRecognition) {
                const rec = new SpeechRecognition()
                rec.continuous = true // Continuous mode enabled
                rec.interimResults = false
                rec.lang = 'ru-RU'

                rec.onresult = (event: any) => {
                    // In continuous mode, we iterate over new results
                    const currentIndex = event.resultIndex
                    const transcript = event.results[currentIndex][0].transcript.trim()

                    if (onTranscriptionRef.current && transcript) {
                        onTranscriptionRef.current(transcript)
                    }
                    // Do NOT stop listening automatically
                }

                rec.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error)
                    setIsListening(false)

                    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                        toast.error('Доступ к микрофону заблокирован', {
                            description: '1. Нажмите на замок 🔒 в адресной строке -> Разрешить микрофон.\n2. Если не помогает: Проверьте "Параметры конфиденциальности микрофона" в Windows.',
                            duration: 10000,
                            action: {
                                label: 'Понятно',
                                onClick: () => { }
                            }
                        })
                    } else if (event.error === 'no-speech') {
                        // Ignore
                    } else {
                        toast.error('Ошибка: ' + event.error)
                    }
                }

                rec.onend = () => {
                    setIsListening(false)
                }

                setRecognition(rec)
            }
        }
    }, []) // Run once on mount

    const toggleListening = useCallback(async () => {
        if (!recognition) {
            toast.error('Распознавание речи не поддерживается браузером')
            return
        }

        if (isListening) {
            recognition.stop()
            setIsListening(false)
            return
        }

        // 1. Try to get explicit permission via getUserMedia (Kickstart)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            // If successful, stop the stream immediately - we just needed the permission
            stream.getTracks().forEach(track => track.stop())
        } catch (error: any) {
            console.error('Microphone access denied:', error)

            // If access is denied, it's likely a system-level block or persistent browser block
            toast.error('Доступ к микрофону заблокирован', {
                description: 'Браузер или Windows блокирует доступ. \n1. Проверьте замок 🔒 в строке адреса.\n2. В Windows: Параметры -> Конфиденциальность -> Микрофон -> Разрешить доступ для приложений.',
                duration: 10000,
            })
            return
        }

        // 2. If we got here, we have permission. Start recognition.
        setIsListening(true)
        try {
            recognition.start()
        } catch (e: any) {
            console.error('Recognition start error:', e)
            setIsListening(false)
            if (!e.message?.includes('started')) {
                toast.error('Ошибка запуска: ' + e.message)
            }
        }
    }, [recognition, isListening])

    if (!recognition && typeof window !== 'undefined') return null

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            className={cn(
                "h-8 w-8 rounded-full transition-all flex items-center justify-center",
                isListening ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/10",
                className
            )}
            title={
                permissionState === 'denied'
                    ? "Доступ к микрофону запрещен"
                    : isListening
                        ? "Остановить запись"
                        : "Голосовой ввод"
            }
        >
            {isListening ? (
                <MicOff className="w-4 h-4" />
            ) : (
                <Mic className={cn("w-4 h-4", permissionState === 'denied' && "text-red-400 opacity-50")} />
            )}
        </Button>
    )
}
