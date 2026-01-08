'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Globe, Send, Check, X } from 'lucide-react'

// --- 1. ОФИЦИАЛЬНЫЕ БРЕНДОВЫЕ ИКОНКИ (Добавляем сюда тоже) ---

function VkIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M15.6 21.3c-6.6 0-10.4-4.5-10.5-12h3.3c.1 4.2 1.9 6 3.4 6.3V9.3h3.3v3.6c2-.2 4.1-2.5 4.8-5h3.1c-.6 2.5-2.2 4.4-3.5 5.2 1.3.6 3.3 2.1 4.1 5.2h-3.4c-.9-2.2-2.5-3.8-4.9-4v3.9h-.7z" />
    </svg>
  )
}

function OkIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12.3c-1.6 0-3.3 0-3.8-1.7 0 0-.4-1.6 1.9-1.6 2.3 0 1.9 1.6 1.9 1.6.5 1.7-1.2 1.7-2.8 1.7zm0-6.8c1.6 0 2.9 1.3 2.9 2.9S13.6 11.3 12 11.3s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9zm5 11c1.3 0 1.7-1.8 1.7-1.8.3-1.3-1.4-1.3-1.4-1.3-2.3 0-3.9 0-5.3-.1-1.4.1-3 .1-5.3.1 0 0-1.7 0-1.4 1.3 0 0 .4 1.8 1.7 1.8 1.1 0 2.9 0 4.1-.1l-2.6 2.6c0 0-1.1 1.2.2 2.3.8.7 2.1-.5 2.1-.5l2.8-3 2.8 3c0 0 1.3 1.2 2.1.5 1.3-1.1.2-2.3.2-2.3l-2.6-2.6c1.2.1 3 .1 4.1.1z" />
    </svg>
  )
}

// --- 2. ОБНОВЛЕННЫЙ КОНФИГ ---

const getPlatformConfig = (platformCode: string) => {
  const code = platformCode?.toLowerCase() || ''
  switch (code) {
    case 'tg':
      return { icon: Send, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Telegram' }
    case 'vk':
      // Используем VkIcon и официальный цвет #0077FF
      return { icon: VkIcon, color: 'text-[#0077FF]', bg: 'bg-blue-50', label: 'VKontakte' }
    case 'ok':
      // Используем OkIcon и официальный цвет #F97400
      return { icon: OkIcon, color: 'text-[#F97400]', bg: 'bg-orange-50', label: 'Odnoklassniki' }
    case 'site':
      return { icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Website' }
    default:
      return { icon: Globe, color: 'text-zinc-500', bg: 'bg-zinc-50', label: platformCode }
  }
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchRecipes = useCallback(async () => {
    const { data } = await supabase.from('publish_recipes').select('*').order('platform')
    if (data) setRecipes(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  const handleSetMain = async (id: string, currentIsMain: boolean, isActive: boolean) => {
    if (currentIsMain) return toast.info('Already Main.')
    if (!isActive) return toast.error('Main platform must be active.')

    const { error } = await supabase.rpc('set_main_recipe', { target_id: id })
    if (error) toast.error(error.message)
    else {
      toast.success('Main channel updated')
      fetchRecipes()
    }
  }

  const handleToggleActive = async (id: string, newState: boolean) => {
    const { error } = await supabase.rpc('toggle_recipe_active', { target_id: id, new_state: newState })
    if (error) toast.error(error.message)
    else {
      toast.success(newState ? 'Platform activated' : 'Platform deactivated')
      fetchRecipes()
    }
  }

  const handleUpdateDelay = async (id: string, delay: number) => {
    const { error } = await supabase.from('publish_recipes').update({ delay_hours: delay }).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchRecipes() // Обновляем список, чтобы сбросить кнопки
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-10 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Publishing Recipes</h1>
        <p className="text-muted-foreground mt-2">Manage automation rules and timings for your channels.</p>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading configurations...</div>
        ) : (
          recipes.map(r => (
            <RecipeRow
              key={r.id}
              recipe={r}
              onToggleActive={handleToggleActive}
              onSetMain={handleSetMain}
              onUpdateDelay={handleUpdateDelay}
            />
          ))
        )}
      </div>
    </div>
  )
}

function RecipeRow({
  recipe,
  onToggleActive,
  onSetMain,
  onUpdateDelay
}: {
  recipe: any,
  onToggleActive: (id: string, val: boolean) => void,
  onSetMain: (id: string, isMain: boolean, isActive: boolean) => void,
  onUpdateDelay: (id: string, delay: number) => Promise<void>
}) {
  const [delay, setDelay] = useState(String(recipe.delay_hours))
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = String(delay) !== String(recipe.delay_hours)

  useEffect(() => {
    setDelay(String(recipe.delay_hours))
  }, [recipe.delay_hours])

  const handleSave = async () => {
    const val = parseFloat(delay)
    if (isNaN(val)) return toast.error('Please enter a valid number')

    setIsSaving(true)
    try {
      await onUpdateDelay(recipe.id, val)
      toast.success('Timing updated')
    } catch (e) {
      toast.error('Failed to update')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setDelay(String(recipe.delay_hours))
  }

  const { icon: Icon, color, bg, label } = getPlatformConfig(recipe.platform)

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md
        ${!recipe.is_active ? 'opacity-75 grayscale-[0.5]' : ''}
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${color.replace('text-', 'bg-')}`} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-3">

        {/* Инфо о платформе с обновленной иконкой */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className={`p-2.5 rounded-lg ${bg}`}>
            {/* Увеличил размер до w-5 h-5 для лучшей читаемости */}
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm flex items-center gap-2">
              {label}
              {recipe.is_main && (
                <Badge variant="default" className="bg-blue-600 h-5 px-1.5 text-[10px]">MAIN</Badge>
              )}
            </span>
            <span className="text-xs text-muted-foreground font-mono uppercase">{recipe.platform}</span>
          </div>
        </div>

        {/* Контролы */}
        <div className="flex items-center gap-6 flex-1 justify-end">

          <div className="flex items-center gap-2">
            <Switch
              id={`active-${recipe.id}`}
              checked={recipe.is_active}
              onCheckedChange={(val) => onToggleActive(recipe.id, val)}
            />
            <label htmlFor={`active-${recipe.id}`} className="text-xs font-medium cursor-pointer select-none">
              {recipe.is_active ? 'On' : 'Off'}
            </label>
          </div>

          <div className={`flex items-center gap-2 transition-opacity ${!recipe.is_active ? 'opacity-30 pointer-events-none' : ''}`}>
            <span className="text-xs text-muted-foreground">Main?</span>
            <Switch
              checked={recipe.is_main}
              onCheckedChange={() => onSetMain(recipe.id, recipe.is_main, recipe.is_active)}
              disabled={recipe.is_main}
            />
          </div>

          <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block" />

          {/* Тайминг */}
          <div className="flex items-center gap-3 justify-end">
            <div className="relative w-24">
              <Input
                type="number"
                min="0"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                className={`
                  bg-white text-black border border-input shadow-sm pr-8 text-right h-9 
                  focus-visible:ring-1 focus-visible:ring-blue-500
                  ${isDirty ? 'border-orange-400 ring-1 ring-orange-400/20' : ''}
                `}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none font-medium">
                ч.
              </div>
            </div>

            {isDirty && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-zinc-500 hover:text-red-600 hover:bg-red-50 text-xs font-medium"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Отменить
                </Button>

                <Button
                  size="sm"
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs font-semibold min-w-[90px]"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Сохранение...' : 'Применить'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}