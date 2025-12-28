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
import { StatusBadge } from '@/components/StatusBadge'

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const { jobs, fetchJobs, updateJobTime, updateBatchJobs } = useCalendarJobs()
  const supabase = useMemo(() => createClient(), [])
  const [recipes, setRecipes] = useState<any[]>([])

  useEffect(() => {
    supabase.from('publish_recipes').select('*').then(({ data }) => { if (data) setRecipes(data) })
  }, [supabase])

  const refreshCalendar = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) fetchJobs(api.view.activeStart, api.view.activeEnd)
  }, [fetchJobs])

  useRealtime('publish_jobs', refreshCalendar)

  const handleEventDrop = async (info: any) => {
    const { event, revert } = info
    const { status, platform, newsId } = event.extendedProps
    const newDate = event.start!

    if (['published', 'processing'].includes(status)) {
      revert(); return toast.error('Cannot move published/processing jobs')
    }

    const mainRecipe = recipes.find(r => r.is_active && r.is_main)
    const isMain = mainRecipe && mainRecipe.platform === platform

    if (isMain) {
      if (confirm('Move ALL linked jobs? Cancel to move only this one.')) {
        // Smart Recalc
        const updates = [{ id: event.id, publish_at: newDate.toISOString() }]
        const baseTime = newDate.getTime()
        recipes.filter(r => r.is_active && !r.is_main).forEach(r => {
          updates.push({
            news_id: newsId,
            platform: r.platform,
            publish_at: new Date(baseTime + (r.delay_hours * 3600000)).toISOString()
          })
        })
        try { await updateBatchJobs(updates); toast.success('Flow recalculated'); refreshCalendar(); }
        catch { revert(); toast.error('Failed'); }
      } else {
        // Move only one
        try { await updateJobTime(event.id, newDate); toast.success('Moved'); }
        catch { revert(); }
      }
    } else {
      try { await updateJobTime(event.id, newDate); toast.success('Moved'); }
      catch { revert(); }
    }
  }

  const events = jobs.map(j => ({
    id: j.id,
    title: `${j.platform}: ${j.news_items?.title || 'Untitled'}`,
    start: j.publish_at,
    backgroundColor:
      j.status === 'published' ? '#059669' : // Emerald 600
        j.status === 'error' ? '#dc2626' :     // Red 600
          j.status === 'processing' ? '#7c3aed' : // Violet 600
            '#2563eb',                             // Blue 600 (Queued)
    borderColor: 'transparent',
    extendedProps: { status: j.status, platform: j.platform, newsId: j.news_id },
    editable: ['queued', 'error'].includes(j.status)
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
            hour12: false
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