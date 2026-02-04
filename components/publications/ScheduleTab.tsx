'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Calendar as CalendarIcon, Clock, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { PLATFORM_CONFIG } from '@/lib/platform-config'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type ScheduleTabProps = {
    contentId: string
    contentType: 'news' | 'review'
    onScheduled: () => void
}

type PublishRecipe = {
    id: string
    platform: string
    is_main: boolean | null
    delay_hours: number | null
    is_active: boolean | null
}

type ValuePiece = Date | null
type CalendarValue = ValuePiece | [ValuePiece, ValuePiece]

export function ScheduleTab({ contentId, contentType, onScheduled }: ScheduleTabProps) {
    const [scheduledDate, setScheduledDate] = useState<Date | null>(null)
    const [publishing, setPublishing] = useState(false)
    const [recipes, setRecipes] = useState<PublishRecipe[]>([])
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    useEffect(() => {
        fetchRecipes()
    }, [])

    const fetchRecipes = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('publish_recipes')
                .select('*')
                .eq('is_active', true)
                .order('is_main', { ascending: false })
                .order('delay_hours', { ascending: true })

            if (error) throw error
            setRecipes(data || [])
        } catch (error: any) {
            toast.error('Ошибка загрузки рецептов: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handlePublish = async (immediate: boolean) => {
        if (!immediate && !scheduledDate) {
            toast.error('Выберите дату и время публикации')
            return
        }

        if (recipes.length === 0) {
            toast.error('Нет активных рецептов публикации')
            return
        }

        setPublishing(true)
        try {
            // Base time: now or scheduled
            const baseDate = immediate ? new Date() : scheduledDate!

            // Generate jobs based on recipes
            const jobs = recipes.map(recipe => {
                let publishAt = new Date(baseDate)

                // Add delay for non-main platforms
                if (!recipe.is_main) {
                    publishAt.setHours(publishAt.getHours() + (recipe.delay_hours || 0))
                }

                return {
                    platform: recipe.platform,
                    status: 'queued',
                    publish_at: publishAt.toISOString(),
                    created_at: new Date().toISOString(),
                    [contentType === 'review' ? 'review_id' : 'news_id']: contentId
                }
            })

            // Insert jobs
            const { error: jobsError } = await supabase
                .from('publish_jobs')
                // @ts-ignore
                .insert(jobs)

            if (jobsError) throw jobsError

            // Update content status
            const { error: updateError } = await supabase
                .from(contentType === 'review' ? 'review_items' : 'news_items')
                // @ts-ignore
                .update({ status: 'approved_for_publish' })
                .eq('id', contentId)

            if (updateError) throw updateError

            toast.success(
                immediate
                    ? `Публикация запущена на ${jobs.length} ${jobs.length === 1 ? 'платформу' : 'платформы'}!`
                    : `Публикация запланирована на ${jobs.length} ${jobs.length === 1 ? 'платформу' : 'платформы'}`
            )
            onScheduled()
        } catch (error: any) {
            toast.error('Ошибка: ' + error.message)
        } finally {
            setPublishing(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">Загрузка рецептов...</p>
                </div>
            </div>
        )
    }

    const mainRecipe = recipes.find(r => r.is_main)
    const delayedRecipes = recipes.filter(r => !r.is_main)

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h3 className="text-base font-semibold mb-2">Публикация по рецептам</h3>
                <p className="text-sm text-muted-foreground">
                    Публикация произойдет автоматически на все активные платформы
                </p>
            </div>

            {/* Preview recipes */}
            {recipes.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-1 h-4 bg-primary rounded-full" />
                        Активные платформы
                    </h4>
                    <div className="grid gap-2">
                        {mainRecipe && (
                            <div className="relative overflow-hidden rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 p-3 shadow-sm">
                                <div className="flex items-center gap-3">
                                    {(() => {
                                        const config = PLATFORM_CONFIG[mainRecipe.platform.toLowerCase()]
                                        const Icon = config?.icon
                                        return (
                                            <>
                                                <div className={cn(
                                                    "flex items-center justify-center w-9 h-9 rounded-lg",
                                                    config?.bgColor || "bg-gray-100"
                                                )}>
                                                    {Icon && <Icon className={cn("w-5 h-5", config?.color || "text-gray-500")} />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-sm">{config?.label || mainRecipe.platform}</div>
                                                    <div className="text-xs text-muted-foreground">Главная платформа</div>
                                                </div>
                                                <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                                                    <span className="text-xs font-bold text-primary">
                                                        Базовое время
                                                    </span>
                                                </div>
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>
                        )}
                        {delayedRecipes.map(recipe => {
                            const config = PLATFORM_CONFIG[recipe.platform.toLowerCase()]
                            const Icon = config?.icon
                            const delayHours = recipe.delay_hours ?? 0
                            return (
                                <div
                                    key={recipe.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                                >
                                    <div className={cn(
                                        "flex items-center justify-center w-9 h-9 rounded-lg",
                                        config?.bgColor || "bg-gray-100"
                                    )}>
                                        {Icon && <Icon className={cn("w-5 h-5", config?.color || "text-gray-500")} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{config?.label || recipe.platform}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {delayHours > 0
                                                ? `Через ${delayHours} ${delayHours === 1 ? 'час' : 'часов'}`
                                                : 'Одновременно с главной'
                                            }
                                        </div>
                                    </div>
                                    {delayHours > 0 && (
                                        <div className="text-xs font-mono text-muted-foreground px-2 py-1 rounded bg-background">
                                            +{delayHours}ч
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {recipes.length === 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        ⚠️ Нет активных рецептов публикации. Настройте их в разделе "Рецепты".
                    </p>
                </div>
            )}

            <div className="flex-1" />

            {/* Scheduling section */}
            <div className="space-y-4 pt-4 border-t">
                <div>
                    <Label className="text-sm font-medium mb-2 block">Запланировать на конкретное время</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full justify-start text-left font-normal h-11",
                                    !scheduledDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduledDate ? (
                                    format(scheduledDate, "PPP HH:mm", { locale: ru })
                                ) : (
                                    <span>Выберите дату и время</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                value={scheduledDate || null}
                                onChange={(value: CalendarValue) => {
                                    const selected = Array.isArray(value) ? value[0] : value
                                    if (!selected) return

                                    const newDate = new Date(selected)
                                    if (scheduledDate) {
                                        newDate.setHours(
                                            scheduledDate.getHours(),
                                            scheduledDate.getMinutes()
                                        )
                                    }
                                    setScheduledDate(newDate)
                                }}
                                selectRange={false}
                                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                            />
                            <div className="p-3 border-t">
                                <Label className="text-xs mb-2 block">Время</Label>
                                <input
                                    type="time"
                                    value={scheduledDate ? format(scheduledDate, "HH:mm") : ""}
                                    onChange={(e) => {
                                        const [hours, minutes] = e.target.value.split(':').map(Number)
                                        const newDate = new Date(scheduledDate || new Date())
                                        newDate.setHours(hours, minutes)
                                        setScheduledDate(newDate)
                                    }}
                                    className="w-full px-3 py-2 border rounded-md text-sm"
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        onClick={() => handlePublish(true)}
                        disabled={publishing || recipes.length === 0}
                        variant="outline"
                        className="h-11 gap-2 border-2"
                    >
                        <Zap className="w-4 h-4" />
                        Опубликовать сейчас
                    </Button>
                    <Button
                        onClick={() => handlePublish(false)}
                        disabled={publishing || !scheduledDate || recipes.length === 0}
                        className="h-11 gap-2"
                    >
                        <Clock className="w-4 h-4" />
                        Запланировать
                    </Button>
                </div>
            </div>
        </div>
    )
}
