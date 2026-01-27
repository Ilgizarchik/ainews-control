'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { HoverCard, HoverCardTrigger } from '@/components/ui/hover-card'
// Используем примитивы Radix UI, чтобы обойти проблемы стилизации Shadcn
import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { Clock, CheckCircle2 } from 'lucide-react'
import { getPlatformConfig } from '@/lib/platform-config'

export function PublicationEventCard({ event }: { event: any }) {
    const config = getPlatformConfig(event.platform)
    const { icon: Icon, label, color, bgColor } = config

    // Генерируем стили на основе конфигурации
    // Используем основной цвет текста для создания ярких границ и фонов
    const strongBorder = color.replace('text-', 'border-')
    const strongBg = color.replace('text-', 'bg-')

    const date = new Date(event.publish_date)
    const isPublished = event.status === 'published'

    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const isDark = mounted && resolvedTheme === 'dark'

    // Цвета для фона (Dark/Light)
    const cardBgColor = isDark ? '#09090b' : '#ffffff'
    const cardBorderColor = isDark ? '#27272a' : '#e4e4e7'

    return (
        <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
                <button
                    className={`
                        w-full text-left mb-1.5 last:mb-0
                        group flex items-center gap-2 p-1.5 rounded-md border-l-[3px]
                        transition-all hover:brightness-95 hover:translate-x-0.5
                        bg-white border-zinc-200 shadow-sm
                        ${strongBorder} 
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
                        backgroundColor: cardBgColor,
                        borderColor: cardBorderColor,
                        zIndex: 9999,
                        opacity: 1
                    }}
                    className="w-80 rounded-xl border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
                >
                    <div className="flex flex-col">
                        <div className={`h-1.5 w-full ${strongBg}`} />

                        <div className="p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`inline-flex items-center gap-1.5 pr-2.5 py-1 rounded-md ${bgColor} ${color} border-0 font-medium text-xs`}>
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </div>
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
                        style={{ fill: cardBgColor }}
                    />
                </HoverCardPrimitive.Content>
            </HoverCardPrimitive.Portal>
        </HoverCard>
    )
}
