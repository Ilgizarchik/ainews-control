'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface MonthYearPickerProps {
    currentDate: Date
    onDateSelect: (date: Date) => void
}

const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i)

export function MonthYearPicker({ currentDate, onDateSelect }: MonthYearPickerProps) {
    const [open, setOpen] = React.useState(false)
    const [selectedMonth, setSelectedMonth] = React.useState(currentDate.getMonth())
    const [selectedYear, setSelectedYear] = React.useState(currentDate.getFullYear())

    // Update internal state when currentDate changes externally
    React.useEffect(() => {
        setSelectedMonth(currentDate.getMonth())
        setSelectedYear(currentDate.getFullYear())
    }, [currentDate])

    const handleApply = () => {
        const newDate = new Date(selectedYear, selectedMonth, 1)
        onDateSelect(newDate)
        setOpen(false)
    }

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
            <PopoverContent className="w-[280px] p-4" align="start">
                <div className="space-y-4">
                    <div className="text-center border-b border-border pb-3">
                        <h4 className="text-sm font-semibold text-foreground">Выбор месяца и года</h4>
                        <p className="text-xs text-muted-foreground mt-1">Переключайтесь между периодами</p>
                    </div>

                    <div className="space-y-3">
                        {/* Month Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Месяц</label>
                            <Select
                                value={selectedMonth.toString()}
                                onValueChange={(value) => setSelectedMonth(parseInt(value))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((month, index) => (
                                        <SelectItem key={index} value={index.toString()}>
                                            {month}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Year Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Год</label>
                            <Select
                                value={selectedYear.toString()}
                                onValueChange={(value) => setSelectedYear(parseInt(value))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {YEARS.map((year) => (
                                        <SelectItem key={year} value={year.toString()}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Apply Button */}
                    <Button
                        onClick={handleApply}
                        className="w-full bg-primary hover:bg-primary/90"
                    >
                        Применить
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
