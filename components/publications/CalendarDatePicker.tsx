'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'

interface CalendarDatePickerProps {
    currentDate: Date
    onDateSelect: (date: Date) => void
}

export function CalendarDatePicker({ currentDate, onDateSelect }: CalendarDatePickerProps) {
    const [open, setOpen] = React.useState(false)
    const [jobs, setJobs] = React.useState<any[]>([])
    const supabase = React.useMemo(() => createClient(), [])

    // 1. Подгружаем активность (статусы постов)
    React.useEffect(() => {
        if (!open) return // Грузим только когда открыли попап

        const fetchActivity = async () => {
            // Берем данные за широкий диапазон (можно оптимизировать по месяцам)
            const { data } = await supabase
                .from('publish_jobs')
                .select('publish_at, status')
            if (data) setJobs(data)
        }
        fetchActivity()
    }, [open, supabase])

    // 2. Создаем карту активности для быстрого поиска
    const activityMap = React.useMemo(() => {
        const map = new Map<string, string>()
        jobs.forEach(job => {
            const dateKey = format(parseISO(job.publish_at), 'yyyy-MM-dd')
            const current = map.get(dateKey)
            // Приоритет: Error > Published > Queued
            if (job.status === 'error') map.set(dateKey, 'error')
            else if (job.status === 'published' && current !== 'error') map.set(dateKey, 'published')
            else if (!current) map.set(dateKey, 'queued')
        })
        return map
    }, [jobs])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                        "text-xl font-bold justify-start text-left font-normal px-2 hover:bg-muted/50 transition-all",
                        !currentDate && "text-muted-foreground"
                    )}
                >
                    <span className="capitalize">
                        {format(currentDate, 'LLLL yyyy', { locale: ru })}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b border-border/50 bg-muted/20 text-center">
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Jump to date</h4>
                </div>
                <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                        if (date) {
                            onDateSelect(date)
                            setOpen(false)
                        }
                    }}
                    locale={ru}
                    initialFocus
                    // Используем modifiers для добавления классов к датам
                    modifiers={{
                        published: (date) => activityMap.get(format(date, 'yyyy-MM-dd')) === 'published',
                        queued: (date) => activityMap.get(format(date, 'yyyy-MM-dd')) === 'queued',
                        error: (date) => activityMap.get(format(date, 'yyyy-MM-dd')) === 'error',
                    }}
                    // Стилизуем точки через CSS псевдо-элементы - это самый надежный способ в v9
                    modifiersClassNames={{
                        published: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-emerald-500 after:rounded-full after:z-50",
                        queued: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-blue-500 after:rounded-full after:z-50",
                        error: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-red-500 after:rounded-full after:z-50",
                    }}
                />
                {/* Легенда */}
                <div className="p-3 border-t border-border/50 flex gap-4 text-[10px] text-muted-foreground justify-center bg-muted/10">
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Pub</div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />Plan</div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" />Err</div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
