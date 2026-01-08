'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { HoverCard, HoverCardTrigger } from '@/components/ui/hover-card'
// Используем примитивы Radix UI, чтобы обойти проблемы стилизации Shadcn
import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { Badge } from '@/components/ui/badge'
import { Globe, Send, Clock, CheckCircle2 } from 'lucide-react'

// --- 1. ОФИЦИАЛЬНЫЕ БРЕНДОВЫЕ ИКОНКИ (FIXED PATHS) ---

function VkIcon({ className }: { className?: string }) {
    return (
        <svg
            role="img"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Официальный путь логотипа VK */}
            <path d="M15.6 21.3c-6.6 0-10.4-4.5-10.5-12h3.3c.1 4.2 1.9 6 3.4 6.3V9.3h3.3v3.6c2-.2 4.1-2.5 4.8-5h3.1c-.6 2.5-2.2 4.4-3.5 5.2 1.3.6 3.3 2.1 4.1 5.2h-3.4c-.9-2.2-2.5-3.8-4.9-4v3.9h-.7z" />
        </svg>
    )
}

function OkIcon({ className }: { className?: string }) {
    return (
        <svg
            role="img"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Официальный путь логотипа OK (Человечек) */}
            <path d="M12 12.3c-1.6 0-3.3 0-3.8-1.7 0 0-.4-1.6 1.9-1.6 2.3 0 1.9 1.6 1.9 1.6.5 1.7-1.2 1.7-2.8 1.7zm0-6.8c1.6 0 2.9 1.3 2.9 2.9S13.6 11.3 12 11.3s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9zm5 11c1.3 0 1.7-1.8 1.7-1.8.3-1.3-1.4-1.3-1.4-1.3-2.3 0-3.9 0-5.3-.1-1.4.1-3 .1-5.3.1 0 0-1.7 0-1.4 1.3 0 0 .4 1.8 1.7 1.8 1.1 0 2.9 0 4.1-.1l-2.6 2.6c0 0-1.1 1.2.2 2.3.8.7 2.1-.5 2.1-.5l2.8-3 2.8 3c0 0 1.3 1.2 2.1.5 1.3-1.1.2-2.3.2-2.3l-2.6-2.6c1.2.1 3 .1 4.1.1z" />
        </svg>
    )
}

// --- 2. КОНФИГУРАЦИЯ ---

const getPlatformConfig = (platformCode: string) => {
    const code = platformCode?.toLowerCase() || ''
    switch (code) {
        case 'tg': return { icon: Send, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-500', label: 'Telegram' }
        // VK и OK теперь используют кастомные компоненты выше
        case 'vk': return { icon: VkIcon, color: 'text-[#0077FF]', bg: 'bg-blue-50', border: 'border-[#0077FF]', label: 'VKontakte' }
        case 'ok': return { icon: OkIcon, color: 'text-[#F97400]', bg: 'bg-orange-50', border: 'border-[#F97400]', label: 'Odnoklassniki' }
        case 'site': return { icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-500', label: 'Website' }
        default: return { icon: Globe, color: 'text-zinc-500', bg: 'bg-zinc-50', border: 'border-zinc-300', label: platformCode }
    }
}

export function PublicationEventCard({ event }: { event: any }) {
    const { icon: Icon, color, bg, border, label } = getPlatformConfig(event.platform)
    const date = new Date(event.publish_date)
    const isPublished = event.status === 'published'

    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const isDark = mounted && resolvedTheme === 'dark'

    // Цвета для фона (Dark/Light)
    const bgColor = isDark ? '#09090b' : '#ffffff'
    const borderColor = isDark ? '#27272a' : '#e4e4e7'

    return (
        <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
                <button
                    className={`
                        w-full text-left mb-1.5 last:mb-0
                        group flex items-center gap-2 p-1.5 rounded-md border-l-[3px]
                        transition-all hover:brightness-95 hover:translate-x-0.5
                        bg-white border-zinc-200 shadow-sm
                        ${border} 
                        ${isPublished ? 'opacity-60 grayscale-[0.3]' : 'opacity-100'}
                    `}
                >
                    <div className="p-1 rounded bg-zinc-50/50 shrink-0">
                        {/* Иконка здесь, размер увеличен до w-3.5 для лучшей видимости */}
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col leading-none gap-0.5">
                        <span className={`text-[10px] font-bold font-mono ${color}`}>
                            {format(date, 'HH:mm')}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-700 truncate pr-1">
                            {event.title}
                        </span>
                    </div>
                </button>
            </HoverCardTrigger>

            {/* Всплывающее окно (Raw Primitive) */}
            <HoverCardPrimitive.Portal>
                <HoverCardPrimitive.Content
                    align="start"
                    side="right"
                    sideOffset={10}
                    style={{
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                        zIndex: 9999,
                        opacity: 1
                    }}
                    className="w-80 rounded-xl border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
                >
                    <div className="flex flex-col">
                        <div className={`h-1.5 w-full ${bg.replace('bg-', 'bg-opacity-100 bg-')}`} />

                        <div className="p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`gap-1.5 pr-2.5 py-1 ${bg} ${color} border-0 font-medium`}>
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {format(date, 'd MMM, HH:mm', { locale: ru })}
                                    </span>
                                </div>

                                {isPublished ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                )}
                            </div>

                            <div className="relative border-t border-border/50 pt-2 mt-1">
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-[240px] overflow-y-auto pr-1">
                                    {event.title}
                                </p>
                            </div>
                        </div>
                    </div>

                    <HoverCardPrimitive.Arrow
                        className="fill-current"
                        style={{ fill: bgColor }}
                    />
                </HoverCardPrimitive.Content>
            </HoverCardPrimitive.Portal>
        </HoverCard>
    )
}