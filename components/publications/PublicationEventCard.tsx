'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { HoverCard, HoverCardTrigger } from '@/components/ui/hover-card'
import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { Clock, CheckCircle2, Wand2 } from 'lucide-react'
import { getPlatformConfig } from '@/lib/platform-config'
import { MagicTextEditor } from './magic-text-editor'
import { createClient } from '@/lib/supabase/client'

export function PublicationEventCard({ event }: { event: any }) {
    const config = getPlatformConfig(event.platform)
    const { icon: Icon, label, color, bgColor } = config

    // Генерируем стили на основе конфигурации
    // Используем основной цвет текста для создания ярких границ и фонов
    const strongBorder = color.replace('text-', 'border-')
    const strongBg = color.replace('text-', 'bg-')

    // Use realStart passed from parent if available, otherwise just use event start
    const date = event.resource?.realStart ? event.resource.realStart : new Date(event.publish_date || event.start)
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

    const [text, setText] = useState(event.title)
    const [showWand, setShowWand] = useState(false)
    const [wandPos, setWandPos] = useState({ top: 0, left: 0 })
    const [editorOpen, setEditorOpen] = useState(false)
    const supabase = createClient()

    const handleMouseUp = (e: React.MouseEvent) => {
        const selection = window.getSelection()
        if (selection && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            setWandPos({
                top: rect.top - 40, // 40px above selection
                left: rect.left + (rect.width / 2) - 16 // Centered
            })
            setShowWand(true)
        } else {
            setShowWand(false)
        }
    }

    const handleSave = async (newText: string) => {
        try {
            const { error } = await supabase
                .from('news_items')
                .update({ title: newText })
                .eq('id', event.id || event.news_item_id) // Support both standard and joined events

            if (error) throw error

            setText(newText)
            setShowWand(false)
        } catch (e) {
            console.error('Failed to update text', e)
        }
    }

    return (
        <>
            <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                    <button
                        className={`
                            w-full text-left mb-0.5 last:mb-0
                            group flex items-center gap-1.5 p-1 rounded-md border-l-[3px]
                            transition-all hover:brightness-95 hover:translate-x-0.5
                            bg-white border-zinc-200 shadow-sm
                            ${strongBorder} 
                            ${isPublished ? 'opacity-60 grayscale-[0.3]' : 'opacity-100'}
                        `}
                    >
                        <div className="p-0.5 rounded bg-zinc-50/50 shrink-0">
                            {/* Иконка здесь, размер увеличен до w-3.5 для лучшей видимости */}
                            <Icon className={`w-3 h-3 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col leading-none gap-0.5">
                            <div className="flex items-baseline justify-between w-full">
                                <span className={`text-[9px] font-bold font-mono ${color} opacity-80`}>
                                    {format(date, 'HH:mm')}
                                </span>
                            </div>
                            <span className="text-[10px] font-medium text-zinc-700 line-clamp-3 pr-1 leading-tight -mt-0.5 break-words whitespace-normal">
                                {text}
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

                                <div className="relative border-t border-border/50 pt-2 mt-1" onMouseUp={handleMouseUp}>
                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-[240px] overflow-y-auto pr-1">
                                        {text}
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

            {/* Floating Magic Wand Button */}
            {showWand && (
                <div
                    className="fixed z-[10000] animate-in zoom-in slide-in-from-bottom-2 duration-300"
                    style={{ top: wandPos.top, left: wandPos.left }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            setEditorOpen(true)
                            setShowWand(false)
                        }}
                        className="
                            bg-gradient-to-r from-purple-500 to-indigo-500 text-white 
                            p-2 rounded-full shadow-lg hover:shadow-purple-500/50 
                            transition-all hover:scale-110 active:scale-95
                            flex items-center justify-center
                        "
                    >
                        <Wand2 className="w-4 h-4" />
                    </button>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gradient-to-r from-purple-500 to-indigo-500 rotate-45" />
                </div>
            )}

            <MagicTextEditor
                isOpen={editorOpen}
                onOpenChange={setEditorOpen}
                originalText={text}
                onSave={handleSave}
                itemId={event.id || event.news_item_id || undefined}
                itemType="news"
            />
        </>
    )
}
