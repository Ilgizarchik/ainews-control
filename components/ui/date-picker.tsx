'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CustomCalendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

type ValuePiece = Date | null
type Value = ValuePiece | [ValuePiece, ValuePiece]

interface DatePickerProps {
    /** Выбранная дата */
    date?: Date
    /** Callback при выборе даты */
    onDateChange?: (date: Date | undefined) => void
    /** Плейсхолдер когда дата не выбрана */
    placeholder?: string
    /** Формат отображения даты (date-fns) */
    dateFormat?: string
    /** Дополнительные классы для кнопки */
    className?: string
    /** Выключенные даты */
    disabled?: (date: Date) => boolean
    /** Минимальная дата */
    fromDate?: Date
    /** Максимальная дата */
    toDate?: Date
}

/** 
 * Универсальный DatePicker (single date)
 * Использует react-calendar + Popover + Button
 */
export function DatePicker({
    date,
    onDateChange,
    placeholder = 'Выберите дату',
    dateFormat = 'PPP',
    className,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false)

    const handleChange = (value: Value) => {
        if (value && !Array.isArray(value)) {
            onDateChange?.(value)
            setOpen(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        'w-full md:w-[300px] justify-start text-left font-normal',
                        !date && 'text-muted-foreground',
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, dateFormat, { locale: ru }) : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <CustomCalendar
                    value={date || null}
                    onChange={handleChange}
                    selectRange={false}
                />
            </PopoverContent>
        </Popover>
    )
}

interface DateRangePickerProps {
    /** Выбранный диапазон */
    dateRange?: [Date | null, Date | null]
    /** Callback при выборе диапазона */
    onDateRangeChange?: (range: [Date | null, Date | null]) => void
    /** Плейсхолдер */
    placeholder?: string
    /** Дополнительные классы */
    className?: string
}

/**
 * DateRangePicker для выбора диапазона дат
 */
export function DateRangePicker({
    dateRange,
    onDateRangeChange,
    placeholder = 'Выберите диапазон',
    className,
}: DateRangePickerProps) {
    const [open, setOpen] = React.useState(false)

    const handleChange = (value: Value) => {
        if (Array.isArray(value)) {
            onDateRangeChange?.(value as [Date | null, Date | null])
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        'w-full md:w-[300px] justify-start text-left font-normal',
                        !dateRange && 'text-muted-foreground',
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.[0] ? (
                        dateRange[1] ? (
                            <>
                                {format(dateRange[0], 'dd MMM', { locale: ru })} -{' '}
                                {format(dateRange[1], 'dd MMM yyyy', { locale: ru })}
                            </>
                        ) : (
                            format(dateRange[0], 'dd MMM yyyy', { locale: ru })
                        )
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <CustomCalendar
                    value={dateRange || null}
                    onChange={handleChange}
                    selectRange={true}
                />
            </PopoverContent>
        </Popover>
    )
}
