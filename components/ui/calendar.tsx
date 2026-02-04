"use client"

import * as React from "react"
import Calendar, { type CalendarProps } from "react-calendar"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { cn } from "@/lib/utils"
import "react-calendar/dist/Calendar.css"
import "@/app/react-calendar.css"

type ValuePiece = Date | null
type Value = ValuePiece | [ValuePiece, ValuePiece]

interface CustomCalendarProps
  extends Omit<CalendarProps, 'className' | 'value' | 'onChange' | 'selectRange'> {
  value?: Value
  onChange?: (value: Value) => void
  selectRange?: boolean
  className?: string
}

export function CustomCalendar({
  value,
  onChange,
  selectRange = true,
  className,
  ...calendarProps
}: CustomCalendarProps) {
  return (
    <div className={cn("custom-calendar-wrapper p-4", className)}>
      <Calendar
        value={value}
        onChange={onChange}
        selectRange={selectRange}
        locale="ru-RU"
        {...calendarProps}
        // Две буквы для дней недели: ПН ВТ СР...
        formatShortWeekday={(locale, date) => {
          const day = format(date, "EEEEEE", { locale: ru }).toUpperCase()
          return day === "ПН" ? "ПН" : day === "ВТ" ? "ВТ" : day === "СР" ? "СР" :
            day === "ЧТ" ? "ЧТ" : day === "ПТ" ? "ПТ" : day === "СБ" ? "СБ" : "ВС"
        }}
        formatMonthYear={(locale, date) => format(date, "LLLL yyyy", { locale: ru })}
        prevLabel={<ChevronLeft className="w-4 h-4" />}
        nextLabel={<ChevronRight className="w-4 h-4" />}
        prev2Label={null}
        next2Label={null}
        showNeighboringMonth={false}
        // ВАЖНО: разрешаем переключение на год/месяц
        minDetail="year"
        maxDetail="month"
        // Показываем 2 месяца рядом для range picker
        showDoubleView={selectRange}
      />
    </div>
  )
}

// Экспорт для обратной совместимости
export { CustomCalendar as Calendar }
