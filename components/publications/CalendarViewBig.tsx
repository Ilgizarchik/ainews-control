'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Calendar, momentLocalizer, Views, Event as RBCEvent } from 'react-big-calendar'
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop'
import moment from 'moment'
import 'moment/locale/ru'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { useCalendarJobs } from '@/hooks/useCalendarJobs'
import { useRealtime } from '@/hooks/useRealtime'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { PublicationEventCard } from './PublicationEventCard'
import { MonthYearPicker } from './MonthYearPicker'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SocialPostEditorDialog } from './SocialPostEditorDialog'
import { JobWithNews } from '@/hooks/useBoardJobs'

moment.locale('ru')
const localizer = momentLocalizer(moment)

const DragAndDropCalendar = withDragAndDrop(Calendar)

type Recipe = {
    is_active: boolean
    is_main: boolean
    platform: string
    delay_hours: number
}

type CalendarEvent = RBCEvent & {
    id: string
    resource: {
        status: string
        platform: string
        newsId?: string
        reviewId?: string
        job: any
    }
}

export function CalendarViewBig() {
    const { jobs, fetchJobs, updateJobTime, updateBatchJobs } = useCalendarJobs()
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewType, setViewType] = useState('month')
    const [editingJob, setEditingJob] = useState<JobWithNews | null>(null)

    useEffect(() => {
        const supabase = createClient()
        supabase.from('publish_recipes').select('*').then(({ data, error }) => {
            if (error) {
                toast.error('Не удалось загрузить настройки публикаций')
                return
            }
            if (data) setRecipes(data as Recipe[])
        })
    }, [])

    const refreshCalendar = useCallback(() => {
        // Fetch jobs for current month view
        const start = moment(currentDate).startOf('month').subtract(7, 'days').toDate()
        const end = moment(currentDate).endOf('month').add(7, 'days').toDate()
        fetchJobs(start, end)
    }, [currentDate, fetchJobs])

    useRealtime('publish_jobs', refreshCalendar)

    useEffect(() => {
        refreshCalendar()
    }, [refreshCalendar])

    const events: CalendarEvent[] = useMemo(() => {
        return jobs.map((j: any) => ({
            id: j.id,
            title: j.news_items?.draft_title || j.news_items?.title || j.review_items?.draft_title || j.review_items?.title_seed || 'Без названия',
            start: new Date(j.publish_at),
            end: new Date(j.publish_at),
            resource: {
                status: j.status,
                platform: j.platform,
                newsId: j.news_id,
                reviewId: j.review_id,
                job: j
            }
        }))
    }, [jobs])

    const handleEventDrop = async ({ event, start }: { event: CalendarEvent; start: Date; end: Date }) => {
        const { status, platform, newsId, reviewId } = event.resource

        if (['published', 'processing'].includes(status)) {
            return toast.error('Нельзя перемещать опубликованные задачи')
        }

        const mainRecipe = recipes.find(r => r.is_active && r.is_main)
        const isMain = !!mainRecipe && mainRecipe.platform === platform

        if (isMain) {
            if (confirm('Перенести ВСЕ связанные публикации? Отмена - только эту.')) {
                const updates: any[] = [{ id: event.id, publish_at: start.toISOString() }]
                const baseTime = start.getTime()

                recipes
                    .filter(r => r.is_active && !r.is_main)
                    .forEach(r => {
                        if (newsId) {
                            updates.push({
                                news_id: newsId,
                                platform: r.platform,
                                publish_at: new Date(baseTime + (Number(r.delay_hours) * 3600000)).toISOString(),
                            })
                        } else if (reviewId) {
                            updates.push({
                                review_id: reviewId,
                                platform: r.platform,
                                publish_at: new Date(baseTime + (Number(r.delay_hours) * 3600000)).toISOString(),
                            })
                        }
                    })

                try {
                    await updateBatchJobs(updates)
                    toast.success('Цепочка пересчитана')
                    refreshCalendar()
                } catch {
                    toast.error('Ошибка')
                }
            } else {
                try {
                    await updateJobTime(event.id, start)
                    toast.success('Перемещено')
                } catch {
                    toast.error('Ошибка перемещения')
                }
            }
        } else {
            try {
                await updateJobTime(event.id, start)
                toast.success('Перемещено')
            } catch {
                toast.error('Ошибка перемещения')
            }
        }
    }

    const handleNavigate = (date: Date) => {
        setCurrentDate(date)
    }

    const handleSelectEvent = (event: CalendarEvent) => {
        const job = jobs.find((j: any) => j.id === event.id)
        if (job) {
            setEditingJob(job as JobWithNews)
        }
    }

    // Custom Event Component
    const EventComponent = ({ event }: { event: CalendarEvent }) => {
        return (
            <div className="w-full h-auto">
                <PublicationEventCard
                    event={{
                        platform: event.resource.platform,
                        publish_date: event.start,
                        status: event.resource.status,
                        title: event.title,
                        id: event.id
                    }}
                />
            </div>
        )
    }

    // Custom Month Event (to ensure all events are shown)
    const MonthEvent = ({ event }: { event: CalendarEvent }) => {
        return (
            <PublicationEventCard
                event={{
                    platform: event.resource.platform,
                    publish_date: event.start,
                    status: event.resource.status,
                    title: event.title,
                    id: event.id
                }}
            />
        )
    }

    return (
        <div className="flex flex-col h-full bg-background rounded-b-xl border-x border-b border-border overflow-hidden">
            {/* Custom Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-lg border border-border bg-background shadow-sm overflow-hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-none hover:bg-muted"
                            onClick={() => handleNavigate(moment(currentDate).subtract(1, viewType === 'month' ? 'month' : 'week').toDate())}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-4 rounded-none border-x border-border font-medium hover:bg-muted"
                            onClick={() => handleNavigate(new Date())}
                        >
                            Сегодня
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-none hover:bg-muted"
                            onClick={() => handleNavigate(moment(currentDate).add(1, viewType === 'month' ? 'month' : 'week').toDate())}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <MonthYearPicker
                        currentDate={currentDate}
                        onDateSelect={handleNavigate}
                    />
                </div>

                <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                    <button
                        onClick={() => setViewType('month')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${viewType === 'month' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                    >
                        Месяц
                    </button>
                    <button
                        onClick={() => setViewType('week')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${viewType === 'week' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                    >
                        Неделя
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-4 bg-background">
                <DragAndDropCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor={(event: any) => event.start}
                    endAccessor={(event: any) => event.end}
                    view={viewType as any}
                    onView={setViewType}
                    date={currentDate}
                    onNavigate={handleNavigate}
                    onEventDrop={handleEventDrop as any}
                    onSelectEvent={handleSelectEvent as any}
                    resizable={false}
                    toolbar={false}
                    views={['month', 'week']}
                    components={{
                        event: EventComponent as any,
                        month: {
                            event: MonthEvent as any,
                        },
                    }}
                    className="rbc-custom-calendar"
                    popup={false}
                    drilldownView={null}
                    showAllEvents={true}
                    showMultiDayTimes={false}
                    step={60}
                    timeslots={1}
                    max={new Date(2100, 0, 1, 23, 0, 0)}
                />
            </div>

            {editingJob && (
                <SocialPostEditorDialog
                    job={editingJob}
                    isOpen={!!editingJob}
                    onClose={() => setEditingJob(null)}
                    onUpdate={refreshCalendar}
                />
            )}

            <style jsx global>{`
                .rbc-custom-calendar {
                    font-family: inherit;
                    height: 100%;
                }

                /* Month View Styles */
                .rbc-header {
                    padding: 12px;
                    font-weight: 700;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: hsl(var(--foreground));
                    border-bottom: 2px solid hsl(var(--border));
                    background: hsl(var(--card));
                }

                .rbc-month-row {
                    border: none;
                    overflow: visible;
                    min-height: auto; /* Allow rows to grow */
                }

                .rbc-day-bg {
                    border: 1px solid hsl(var(--border) / 0.5);
                    background: hsl(var(--background));
                    transition: background-color 0.2s;
                }

                .rbc-day-bg:hover {
                    background: hsl(var(--muted) / 0.3);
                }

                .rbc-off-range-bg {
                    background: hsl(var(--muted) / 0.2);
                }

                .rbc-today {
                    background: hsl(var(--primary) / 0.05) !important;
                }

                .rbc-date-cell {
                    padding: 8px;
                    text-align: left;
                }

                .rbc-date-cell > a {
                    color: hsl(var(--muted-foreground));
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-decoration: none;
                }

                .rbc-now .rbc-date-cell > a {
                    background: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    border-radius: 6px;
                    padding: 2px 8px;
                    display: inline-block;
                }

                .rbc-event {
                    background: transparent;
                    border: none;
                    padding: 0;
                    margin: 1px 4px;
                }

                .rbc-event:hover {
                    background: transparent;
                }

                .rbc-event-content {
                    padding: 0;
                }

                .rbc-row-content {
                    padding: 4px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    /* Remove max-height to show all events */
                    overflow-y: visible;
                }

                /* Make the entire calendar scrollable if needed */
                .rbc-month-view {
                    border: none;
                    border-radius: 12px;
                    overflow: auto;
                    max-height: calc(100vh - 280px); /* Account for header */
                }

                /* Week View Styles */
                .rbc-time-view {
                    border: none;
                    border-radius: 12px;
                    overflow: hidden;
                }

                .rbc-time-header {
                    border-bottom: 2px solid hsl(var(--border));
                }

                .rbc-time-content {
                    border-top: none;
                }

                .rbc-timeslot-group {
                    border-left: 1px solid hsl(var(--border) / 0.4);
                }

                .rbc-time-slot {
                    border-top: 1px solid hsl(var(--border) / 0.3);
                }

                .rbc-current-time-indicator {
                    background-color: hsl(var(--primary));
                    height: 2px;
                }

                .rbc-time-header-content {
                    border-left: 1px solid hsl(var(--border));
                }

                .rbc-label {
                    color: hsl(var(--muted-foreground));
                    font-size: 0.75rem;
                }

                .rbc-allday-cell {
                    background: hsl(var(--muted) / 0.2);
                }

                /* Drag and Drop Styles */
                .rbc-addons-dnd-dragging {
                    opacity: 0.5;
                }

                .rbc-addons-dnd-over {
                    background: hsl(var(--primary) / 0.1) !important;
                }
            `}</style>
        </div>
    )
}
