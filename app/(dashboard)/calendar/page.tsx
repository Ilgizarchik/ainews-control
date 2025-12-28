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

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const { jobs, fetchJobs, updateJobTime, updateBatchJobs } = useCalendarJobs()
  const supabase = useMemo(() => createClient(), [])
  const [recipes, setRecipes] = useState<Recipe[]>([])

  useEffect(() => {
    supabase
      .from('publish_recipes')
      .select('*')
      .then(({ data }) => {
        if (data) setRecipes(data as Recipe[])
      })
  }, [supabase])

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

  const events = jobs.map((j: any) => ({
    id: j.id,
    title: `${j.platform}: ${j.news_items?.title || 'Untitled'}`,
    start: j.publish_at,
    backgroundColor:
      j.status === 'published' ? '#059669' :
      j.status === 'error' ? '#dc2626' :
      j.status === 'processing' ? '#7c3aed' :
      '#2563eb',
    borderColor: 'transparent',
    extendedProps: { status: j.status, platform: j.platform, newsId: j.news_id },
    editable: ['queued', 'error'].includes(j.status),
  }))

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex-1 min-h-0 p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
          events={events}
          eventDrop={handleEventDrop}
          datesSet={(arg) => fetchJobs(arg.start, arg.end)}
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
            <div className={`flex flex-col w-full h-full overflow-hidden ${eventInfo.view.type === 'dayGridMonth' ? 'p-0.5' : 'p-1'}`}>
              <div className="text-[10px] font-bold opacity-90 mb-0.5 whitespace-nowrap">
                {eventInfo.timeText}
              </div>
              <div className="text-xs leading-tight whitespace-normal break-words font-medium">
                {eventInfo.event.title}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
