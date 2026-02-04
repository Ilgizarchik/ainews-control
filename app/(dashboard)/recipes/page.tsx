'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Globe, Send, Clock, X, Star, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- 1. ОФИЦИАЛЬНЫЕ БРЕНДОВЫЕ ИКОНКИ ---

function VkIcon({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <path d="M15.6 21.3c-6.6 0-10.4-4.5-10.5-12h3.3c.1 4.2 1.9 6 3.4 6.3V9.3h3.3v3.6c2-.2 4.1-2.5 4.8-5h3.1c-.6 2.5-2.2 4.4-3.5 5.2 1.3.6 3.3 2.1 4.1 5.2h-3.4c-.9-2.2-2.5-3.8-4.9-4v3.9h-.7z" />
    </svg>
  )
}

function OkIcon({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12.3c-1.6 0-3.3 0-3.8-1.7 0 0-.4-1.6 1.9-1.6 2.3 0 1.9 1.6 1.9 1.6.5 1.7-1.2 1.7-2.8 1.7zm0-6.8c1.6 0 2.9 1.3 2.9 2.9S13.6 11.3 12 11.3s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9zm5 11c1.3 0 1.7-1.8 1.7-1.8.3-1.3-1.4-1.3-1.4-1.3-2.3 0-3.9 0-5.3-.1-1.4.1-3 .1-5.3.1 0 0-1.7 0-1.4 1.3 0 0 .4 1.8 1.7 1.8 1.1 0 2.9 0 4.1-.1l-2.6 2.6c0 0-1.1 1.2.2 2.3.8.7 2.1-.5 2.1-.5l2.8-3 2.8 3c0 0 1.3 1.2 2.1.5 1.3-1.1.2-2.3.2-2.3l-2.6-2.6c1.2.1 3 .1 4.1.1z" />
    </svg>
  )
}

function FbIcon({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function ThreadsIcon({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <path d="M12.002 2.002c-5.522 0-9.998 4.476-9.998 9.998 0 5.522 4.476 9.998 9.998 9.998 5.522 0 9.998-4.476 9.998-9.998 0-5.522-4.476-9.998-9.998-9.998zm0 18.498c-4.69 0-8.5-3.81-8.5-8.5 0-4.69 3.81-8.5 8.5-8.5 4.69 0 8.5 3.81 8.5 8.5 0 4.69-3.81 8.5-8.5 8.5zm3.75-8.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zm-3.75 2.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zm6.5-2.25h-1.5a5.25 5.25 0 0 0-10.5 0 5.25 5.25 0 0 0 10.5 0v.75a.75.75 0 0 1-1.5 0v-.75a3.75 3.75 0 0 1-7.5 0 3.75 3.75 0 0 1 7.5 0h1.5a.75.75 0 0 1 0 1.5H12a5.25 5.25 0 0 1-5.25-5.25 5.25 5.25 0 0 1 5.25-5.25 5.25 5.25 0 0 1 5.25 5.25v.75z" />
      <path d="M17.75 12a5.75 5.75 0 0 0-4.46-5.59 6.75 6.75 0 0 1 4.46 5.59z" fill="none" />
      <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 9.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
    </svg>
  )
}

function XIcon({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  )
}

// --- 2. КОНФИГ ПЛАТФОРМ ---

const getPlatformConfig = (platformCode: string) => {
  const code = platformCode?.toLowerCase() || ''
  switch (code) {
    case 'tg':
      return {
        icon: Send,
        colorClass: 'text-blue-500',
        bgClass: 'bg-blue-50',
        label: 'Telegram',
        barColor: '#3B82F6' // blue-500
      }
    case 'vk':
      return {
        icon: VkIcon,
        colorClass: 'text-[#0077FF]',
        bgClass: 'bg-[#0077FF]/10',
        label: 'ВКонтакте',
        barColor: '#0077FF',
        customStyle: { color: '#0077FF' }
      }
    case 'ok':
      return {
        icon: OkIcon,
        colorClass: 'text-[#F97400]',
        bgClass: 'bg-[#F97400]/10',
        label: 'Одноклассники',
        barColor: '#F97400',
        customStyle: { color: '#F97400' }
      }
    case 'fb':
      return {
        icon: FbIcon,
        colorClass: 'text-[#1877F2]',
        bgClass: 'bg-[#1877F2]/10',
        label: 'Facebook',
        barColor: '#1877F2',
        customStyle: { color: '#1877F2' }
      }
    case 'threads':
      return {
        icon: ThreadsIcon,
        colorClass: 'text-black dark:text-white',
        bgClass: 'bg-zinc-100 dark:bg-zinc-800',
        label: 'Threads',
        barColor: '#000000'
      }
    case 'x':
      return {
        icon: XIcon,
        colorClass: 'text-black dark:text-white',
        bgClass: 'bg-zinc-100 dark:bg-zinc-800',
        label: 'X (Twitter)',
        barColor: '#000000'
      }
    case 'site':
      return {
        icon: Globe,
        colorClass: 'text-emerald-500',
        bgClass: 'bg-emerald-50',
        label: 'Вебсайт',
        barColor: '#10B981' // emerald-500
      }
    default:
      return {
        icon: Globe,
        colorClass: 'text-zinc-500',
        bgClass: 'bg-zinc-50',
        label: platformCode,
        barColor: '#71717A' // zinc-500
      }
  }
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchRecipes = useCallback(async () => {
    // 1. Fetch recipes
    const { data: recipesData, error } = await supabase.from('publish_recipes').select('*')
    if (error) {
      toast.error('Failed to load recipes')
      setLoading(false)
      return
    }

    // 2. Fetch order
    const { data: settingsData } = await supabase
      .from('project_settings')
      .select('value')
      .eq('project_key', 'ainews')
      .eq('key', 'recipes_order')
      .single()

    let orderedRecipes = recipesData as any[]
    const settings = settingsData as any

    if (settings?.value) {
      try {
        const orderIds = JSON.parse(settings.value) as string[]
        orderedRecipes.sort((a, b) => {
          const indexA = orderIds.indexOf(String(a.id))
          const indexB = orderIds.indexOf(String(b.id))
          if (indexA !== -1 && indexB !== -1) return indexA - indexB
          if (indexA !== -1) return -1
          if (indexB !== -1) return 1
          return a.platform.localeCompare(b.platform)
        })
      } catch (e) {
        console.error('Failed to parse recipes order', e)
      }
    } else {
      orderedRecipes.sort((a, b) => a.platform.localeCompare(b.platform))
    }

    setRecipes(orderedRecipes)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  const handleSetMain = async (id: string, currentIsMain: boolean, isActive: boolean) => {
    if (currentIsMain) return // Уже основной, ничего не делаем
    if (!isActive) return toast.error('Основной канал должен быть активен')

    const { error } = await supabase.rpc('set_main_recipe', { target_id: id } as any)
    if (error) toast.error(error.message)
    else {
      toast.success('Основной канал обновлен')
      fetchRecipes()
    }
  }

  const handleToggleActive = async (id: string, newState: boolean) => {
    const { error } = await supabase.rpc('toggle_recipe_active', { target_id: id, new_state: newState } as any)
    if (error) toast.error(error.message)
    else {
      toast.success(newState ? 'Канал активирован' : 'Канал отключен')
      fetchRecipes()
    }
  }

  const handleUpdateDelay = async (id: string, delay: number) => {
    const { error } = await supabase.from('publish_recipes').update({ delay_hours: delay }).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchRecipes()
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setRecipes((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        const newItems = arrayMove(items, oldIndex, newIndex)

        // Save new order
        const newOrderIds = newItems.map(i => String(i.id))

        supabase
          .from('project_settings')
          .upsert({
            project_key: 'ainews',
            key: 'recipes_order',
            value: JSON.stringify(newOrderIds),
            is_active: true
          })
          .then(({ error }) => {
            if (error) toast.error('Failed to save order')
          })

        return newItems
      })
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-10 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройка публикаций</h1>
        <p className="text-muted-foreground mt-2">Управление правилами автоматизации и таймингами для ваших каналов.</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={recipes.map(r => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-4">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Загрузка конфигурации...</div>
            ) : (
              recipes.map(r => (
                <SortableRecipeRow
                  key={r.id}
                  recipe={r}
                  onToggleActive={handleToggleActive}
                  onSetMain={handleSetMain}
                  onUpdateDelay={handleUpdateDelay}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableRecipeRow(props: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.recipe.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <RecipeRow {...props} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  )
}

function RecipeRow({
  recipe,
  onToggleActive,
  onSetMain,
  onUpdateDelay,
  dragHandle
}: {
  recipe: any,
  onToggleActive: (id: string, val: boolean) => void,
  onSetMain: (id: string, isMain: boolean, isActive: boolean) => void,
  onUpdateDelay: (id: string, delay: number) => Promise<void>,
  dragHandle?: any
}) {
  const [delay, setDelay] = useState(String(recipe.delay_hours))
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = String(delay) !== String(recipe.delay_hours)

  useEffect(() => {
    setDelay(String(recipe.delay_hours))
  }, [recipe.delay_hours])

  const handleSave = async () => {
    const val = parseFloat(delay)
    if (isNaN(val)) return toast.error('Введите корректное число')

    setIsSaving(true)
    try {
      await onUpdateDelay(recipe.id, val)
      toast.success('Тайминг обновлен')
    } catch (e) {
      toast.error('Ошибка обновления')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setDelay(String(recipe.delay_hours))
  }

  const { icon: Icon, colorClass, bgClass, label, barColor, customStyle } = getPlatformConfig(recipe.platform)

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md
        ${!recipe.is_active ? 'opacity-80 grayscale-[0.3]' : ''}
      `}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: barColor }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-3">

        {/* 1. Инфо о платформе + Drag Handle */}
        <div className="flex items-center gap-3 min-w-[200px]">
          {/* Drag Handle */}
          <div
            {...dragHandle}
            className="p-1.5 -ml-2 text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-md transition-colors"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div
            className={`p-2.5 rounded-lg ${bgClass}`}
            style={customStyle ? { backgroundColor: `${customStyle.color}1A` } : undefined} // 10% opacity fallback
          >
            <Icon
              className={`w-5 h-5 ${colorClass}`}
              style={customStyle}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm flex items-center gap-2">
              {label}
            </span>
            <span className="text-xs text-muted-foreground font-mono uppercase">{recipe.platform}</span>
          </div>
        </div>

        {/* 2. Контролы */}
        <div className="flex items-center gap-4 flex-1 justify-end">

          {/* Активность */}
          <div className="flex items-center justify-end gap-2 w-[120px]">
            <span className={`text-xs font-medium ${recipe.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {recipe.is_active ? 'Включено' : 'Выключено'}
            </span>
            <Switch
              checked={recipe.is_active}
              onCheckedChange={(val) => onToggleActive(recipe.id, val)}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          <div className="h-8 w-[1px] bg-border hidden sm:block" />

          {/* Основной канал (Звезда) */}
          <div className="flex items-center justify-center w-[60px]">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 hover:bg-transparent",
                recipe.is_main ? "text-yellow-500 hover:text-yellow-600" : "text-zinc-300 hover:text-yellow-400"
              )}
              onClick={() => onSetMain(recipe.id, recipe.is_main, recipe.is_active)}
              disabled={!recipe.is_active}
              title={recipe.is_main ? "Основной канал" : "Сделать основным"}
            >
              <Star className={cn("w-5 h-5", recipe.is_main && "fill-current")} />
            </Button>
          </div>

          <div className="h-8 w-[1px] bg-border hidden sm:block" />

          {/* Тайминг (Задержка) */}
          <div className="flex items-center justify-end gap-2 min-w-[280px]">
            <div className="relative w-28">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="number"
                min="0"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                className={`
                  pl-8 pr-8 h-9 text-sm
                  ${isDirty ? 'border-orange-400 ring-1 ring-orange-400/20' : ''}
                `}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                ч.
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="w-[160px] flex justify-end">
              {isDirty && (
                <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-zinc-500 hover:text-red-600 hover:bg-red-50"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? '...' : 'Сохранить'}
                  </Button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
