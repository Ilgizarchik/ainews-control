'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useCalendarJobs } from '@/hooks/useCalendarJobs'
import { useRealtime } from '@/hooks/useRealtime'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { PublicationEventCard } from './PublicationEventCard'
import { CalendarDatePicker } from './CalendarDatePicker' // Импорт нашего нового пикера
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ... (Типы Recipe, BatchUpdate и CalendarExtendedProps оставляем как были) ...
type Recipe = {
    is_active: boolean
    is_main: boolean
    platform: string
    delay_hours: number
}

type BatchUpdate =
    | { id: string; publish_at: string }
    | { news_id: string; platform: string; publish_at: string }

type CalendarExtendedProps = {
    status: string
    platform: string
    newsId: string
}

export function CalendarView() {
    const calendarRef = useRef<FullCalendar>(null)
    const { jobs, fetchJobs, updateJobTime, updateBatchJobs } = useCalendarJobs()
    const supabase = useMemo(() => createClient(), [])
    const [recipes, setRecipes] = useState<Recipe[]>([])

    // Состояние для отображения текущей даты в нашем кастомном хедере
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewType, setViewType] = useState('dayGridMonth') // dayGridMonth или timeGridWeek

    useEffect(() => {
        supabase.from('publish_recipes').select('*').then(({ data }) => {
            if (data) setRecipes(data as Recipe[])
        })
    }, [supabase])

    // ... (Логику refreshCalendar, useRealtime, handleEventDrop оставляем без изменений) ...
    const refreshCalendar = useCallback(() => {
        const api = calendarRef.current?.getApi()
        if (api) fetchJobs(api.view.activeStart, api.view.activeEnd)
    }, [fetchJobs])

    useRealtime('publish_jobs', refreshCalendar)

    const handleEventDrop = async (info: any) => {
        const { event, revert } = info

        const ext = (event.extendedProps || {}) as CalendarExtendedProps
        const status = String(ext.status || '')
        const platform = String(ext.platform || '')
        const newsId = String(ext.newsId || '')

        const newDate: Date | null = event.start ?? null
        if (!newDate) {
            revert()
            return toast.error('No start date')
        }

        if (['published', 'processing'].includes(status)) {
            revert()
            return toast.error('Cannot move published/processing jobs')
        }

        const mainRecipe = recipes.find(r => r.is_active && r.is_main)
        const isMain = !!mainRecipe && mainRecipe.platform === platform

        if (isMain) {
            if (confirm('Move ALL linked jobs? Cancel to move only this one.')) {
                const updates: BatchUpdate[] = [{ id: String(event.id), publish_at: newDate.toISOString() }]
                const baseTime = newDate.getTime()

                recipes
                    .filter(r => r.is_active && !r.is_main)
                    .forEach(r => {
                        updates.push({
                            news_id: newsId,
                            platform: r.platform,
                            publish_at: new Date(baseTime + (Number(r.delay_hours) * 3600000)).toISOString(),
                        })
                    })

                try {
                    await updateBatchJobs(updates as any)
                    toast.success('Flow recalculated')
                    refreshCalendar()
                } catch {
                    revert()
                    toast.error('Failed')
                }
            } else {
                try {
                    await updateJobTime(String(event.id), newDate)
                    toast.success('Moved')
                } catch {
                    revert()
                }
            }
        } else {
            try {
                await updateJobTime(String(event.id), newDate)
                toast.success('Moved')
            } catch {
                revert()
            }
        }
    }

    // --- CUSTOM NAVIGATION HANDLERS ---
    const handlePrev = () => {
        const api = calendarRef.current?.getApi()
        api?.prev()
        setCurrentDate(api?.getDate() || new Date())
    }

    const handleNext = () => {
        const api = calendarRef.current?.getApi()
        api?.next()
        setCurrentDate(api?.getDate() || new Date())
    }

    const handleToday = () => {
        const api = calendarRef.current?.getApi()
        api?.today()
        setCurrentDate(api?.getDate() || new Date())
    }

    const handleDateSelect = (date: Date) => {
        const api = calendarRef.current?.getApi()
        api?.gotoDate(date)
        setCurrentDate(date)
    }

    const handleViewChange = (view: string) => {
        const api = calendarRef.current?.getApi()
        api?.changeView(view)
        setViewType(view)
    }

    // Событие, когда календарь сам меняет даты (например, при свайпе или драге)
    const handleDatesSet = (arg: any) => {
        setCurrentDate(arg.view.currentStart)
        fetchJobs(arg.start, arg.end)
    }

    const events = jobs.map((j: any) => ({
        id: j.id,
        title: j.news_items?.draft_title || j.news_items?.title || 'Untitled',
        start: j.publish_at,
        backgroundColor: 'transparent', // Убираем дефолтный фон, так как у нас свой компонент карточки
        borderColor: 'transparent',
        extendedProps: { status: j.status, platform: j.platform, newsId: j.news_id },
        editable: ['queued', 'error'].includes(j.status),
    }))

    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    return (
        <div className="flex flex-col h-full bg-background rounded-lg border border-border overflow-hidden">

            {/* --- CUSTOM TOOLBAR --- */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
                <div className="flex items-center gap-2">
                    {/* Кнопки навигации */}
                    <div className="flex items-center rounded-md border border-border bg-background shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none rounded-l-md" onClick={handlePrev}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-3 rounded-none border-l border-r border-border font-normal" onClick={handleToday}>
                            Today
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none rounded-r-md" onClick={handleNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* НАШ НОВЫЙ PICKER */}
                    <CalendarDatePicker
                        currentDate={currentDate}
                        onDateSelect={handleDateSelect}
                    />
                </div>

                {/* Переключатель вида */}
                <div className="flex bg-muted p-1 rounded-md">
                    <button
                        onClick={() => handleViewChange('dayGridMonth')}
                        className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewType === 'dayGridMonth' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Month
                    </button>
                    <button
                        onClick={() => handleViewChange('timeGridWeek')}
                        className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewType === 'timeGridWeek' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Week
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-0 relative">
                {mounted && (
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        // ОТКЛЮЧАЕМ ВСТРОЕННЫЙ ХЕДЕР
                        headerToolbar={false}
                        events={events}
                        eventDrop={handleEventDrop}
                        datesSet={handleDatesSet} // Важно: синхронизация дат
                        height="100%"
                        editable={true}
                        eventTimeFormat={{
                            hour: '2-digit',
                            minute: '2-digit',
                            meridiem: false,
                            hour12: false,
                        }}
                        slotEventOverlap={false}
                        eventContent={(eventInfo) => (
                            <PublicationEventCard event={{
                                platform: eventInfo.event.extendedProps.platform,
                                publish_date: eventInfo.event.start,
                                status: eventInfo.event.extendedProps.status,
                                title: eventInfo.event.title
                            }} />
                        )}
                    />
                )}
            </div>
        </div>
    )
}
