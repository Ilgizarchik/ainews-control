'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, X, Terminal, Activity, Sparkles, CheckCircle, AlertTriangle, Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

// Context for global access if needed
export const WittyLoggerContext = React.createContext<{
    log: (msg: string, type?: 'info' | 'success' | 'wait' | 'error') => void
}>({ log: () => { } })

type LogMessage = {
    id: string
    text: string
    type: 'info' | 'success' | 'wait' | 'error' | 'thinking'
    timestamp: number
}

const PHRASES = {
    scan_start: [
        "Так-с, что тут у нас в интернетах...",
        "Запускаю свои цифровые щупальца 🐙",
        "Погнали искать свежие новости!",
        "Выпускайте кракена... то есть парсер!"
    ],
    found_item: [
        "Опа, свежак подъехал!",
        "Вижу что-то новенькое...",
        "Хмм, любопытный заголовок.",
        "В копилку знаний! 📚"
    ],
    gate1_pass: [
        "Это мы одобряем! ✅",
        "Годный контент, берем.",
        "Вроде не скам, пропускаю.",
        "Ну наконец-то что-то стоящее."
    ],
    gate1_block: [
        "Какая-то дичь, в мусорку. 🗑️",
        "Не, ну это нам не подходит.",
        "Реклама или спам? Давай, до свидания.",
        "Скукотища, скипаем."
    ],
    generating: [
        "Включаю режим писателя... ✍️",
        "Колдую над текстом... ✨",
        "Ща как перепишу по-красоте!",
        "Нейроны скрипят, но работают."
    ],
    image_gen: [
        "Рисую шедевр... 🎨",
        "Подбираю краски для картинки...",
        "Сейчас будет красиво (надеюсь).",
        "Генерация пикселей запущена."
    ],
    create_social: [
        "Пишу посты для соцсетей... 📱",
        "Адаптирую контент под Telegram и VK...",
        "Накидываю хэштеги и смайлики... #️⃣",
        "Разливаю контент по платформам..."
    ],
    idle: [
        "Работа сделана. Пойду вздремну. 😴",
        "Жду новых задач, командир.",
        "Тишина и покой...",
        "Пока пусто, можно и чайку попить. ☕"
    ]
}

function getRandomPhrase(key: keyof typeof PHRASES) {
    const list = PHRASES[key]
    return list[Math.floor(Math.random() * list.length)]
}

export function WittyBotLogger() {
    const [messages, setMessages] = useState<LogMessage[]>([])
    const [isVisible, setIsVisible] = useState(true)
    const [isSleepy, setIsSleepy] = useState(true)
    const logsEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Sound effect (optional, maybe too annoying)
    // const playSound = () => { ... }

    const sleepTimerRef = useRef<NodeJS.Timeout | null>(null)

    const resetSleepTimer = useCallback(() => {
        if (sleepTimerRef.current) {
            clearTimeout(sleepTimerRef.current)
        }
        sleepTimerRef.current = setTimeout(() => {
            setIsSleepy(true)
            // addLog(getRandomPhrase('idle'), 'info') // Optional: final message before sleep
        }, 15000) // Sleep after 15s of inactivity
    }, [])

    const addLog = useCallback((text: string, type: LogMessage['type'] = 'info') => {
        setIsSleepy(false)
        setIsVisible(true)
        setMessages(prev => {
            const next = [...prev, {
                id: Math.random().toString(36).substring(7),
                text,
                type,
                timestamp: Date.now()
            }]
            // Keep last 50 logs
            return next.slice(-50)
        })

        // Reset to sleepy after timeout
        resetSleepTimer()
    }, [resetSleepTimer])

    // Scroll to bottom
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    // Subscription
    useEffect(() => {
        const channel = supabase
            .channel('witty-logger')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'news_items' },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload as any

                    // INSERT -> Found
                    if (eventType === 'INSERT') {
                        addLog(`${getRandomPhrase('found_item')} (${newRecord.title?.substring(0, 30)}...)`, 'info')
                    }

                    // UPDATE -> Status Changes
                    if (eventType === 'UPDATE') {
                        const status = newRecord.status
                        const oldStatus = oldRecord.status

                        // Gate 1 Decision
                        if (newRecord.gate1_decision === 'block' && oldRecord.gate1_decision !== 'block') {
                            addLog(getRandomPhrase('gate1_block'), 'error')
                        } else if (newRecord.gate1_decision === 'send' && oldRecord.gate1_decision !== 'send') {
                            addLog(`${getRandomPhrase('gate1_pass')} (Score: ${newRecord.gate1_score})`, 'success')
                        }

                        // Generation
                        if (status === 'approved_for_adaptation' && oldStatus !== 'approved_for_adaptation') {
                            addLog(getRandomPhrase('generating'), 'thinking')
                        }

                        // Image Generation (heuristic based on fields)
                        if (newRecord.draft_image_prompt && !oldRecord.draft_image_prompt) {
                            addLog(getRandomPhrase('image_gen'), 'info')
                        }
                    }
                }
            )
            .subscribe()

        // Listen for direct broadcast events from backend (Ingestion Service)
        const broadcastChannel = supabase
            .channel('ingestion-updates')
            .on(
                'broadcast',
                { event: 'scan-status' },
                (payload) => {
                    const { message, type } = payload.payload
                    addLog(message, type || 'info')
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
            supabase.removeChannel(broadcastChannel)
            if (sleepTimerRef.current) {
                clearTimeout(sleepTimerRef.current)
            }
        }
    }, [addLog, supabase])

    // Custom Event Listener for internal app events
    useEffect(() => {
        const handleCustomLog = (e: CustomEvent<any>) => {
            const { text, type } = e.detail
            addLog(text, type)
        }

        window.addEventListener('witty-log', handleCustomLog as EventListener);
        (window as any).wittyLog = addLog

        return () => {
            window.removeEventListener('witty-log', handleCustomLog as EventListener)
        }
    }, [addLog])

    if (!isVisible && isSleepy) {
        return (
            <div
                className="fixed bottom-6 right-6 z-50 cursor-pointer hover:scale-110 transition-transform"
                onClick={() => setIsVisible(true)}
            >
                <div className="relative">
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-3 rounded-full shadow-xl border-2 border-white/20">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={cn(
            "fixed bottom-6 right-6 z-50 w-80 md:w-96 transition-all duration-500 ease-in-out font-mono",
            isSleepy ? "translate-y-[calc(100%-60px)] opacity-50 hover:opacity-100 hover:translate-y-0" : "translate-y-0 opacity-100"
        )}>
            <div className="bg-zinc-950/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
                {/* Header */}
                <div className="h-10 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-b border-white/10 flex items-center justify-between px-3 cursor-pointer" onClick={() => setIsSleepy(!isSleepy)}>
                    <div className="flex items-center gap-2">
                        <Bot className={cn("w-4 h-4 text-indigo-400", !isSleepy && "animate-bounce")} />
                        <span className="text-xs font-bold text-indigo-200">AI SYSTEM MONITOR</span>
                        {isSleepy ? (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                            </span>
                        ) : (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsVisible(false) }}
                            className="text-white/40 hover:text-white transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-black/50">
                    <AnimatePresence initial={false}>
                        {messages.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-8 text-zinc-500 text-xs italic"
                            >
                                <Coffee className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                Система в ожидании...
                            </motion.div>
                        )}
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex gap-3 text-xs"
                            >
                                <div className="mt-0.5 shrink-0">
                                    {msg.type === 'info' && <Terminal className="w-3.5 h-3.5 text-blue-400" />}
                                    {msg.type === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                                    {msg.type === 'wait' && <Activity className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />}
                                    {msg.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                                    {msg.type === 'thinking' && <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin-slow" />}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className={cn(
                                        "leading-relaxed",
                                        msg.type === 'error' ? "text-red-300" : "text-zinc-300"
                                    )}>
                                        {msg.text}
                                    </span>
                                    <span className="text-[9px] text-zinc-600 font-mono">
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    )
}
