'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save, FileText, GripVertical, Send, Globe } from 'lucide-react'
import { TutorialButton } from '@/components/tutorial/TutorialButton'
import { getPromptsTutorialSteps } from '@/lib/tutorial/tutorial-config'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSearchParams, useRouter } from 'next/navigation'
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

// --- БРЕНДОВЫЕ ИКОНКИ СОЦСЕТЕЙ ---

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

// --- Маппинг соцсетей на иконки и цвета ---

const getSocialConfig = (key: string) => {
  const keyLower = key.toLowerCase()

  if (keyLower.includes('_vk')) {
    return {
      icon: VkIcon,
      color: '#0077FF',
      bg: 'from-[#0077FF]/15 to-[#0077FF]/10',
      borderColor: 'border-[#0077FF]/20',
      textColor: 'text-[#0077FF]'
    }
  }
  if (keyLower.includes('_tg')) {
    return {
      icon: Send,
      color: '#0088CC',
      bg: 'from-blue-500/15 to-blue-600/10',
      borderColor: 'border-blue-500/20',
      textColor: 'text-blue-600 dark:text-blue-400'
    }
  }
  if (keyLower.includes('_fb')) {
    return {
      icon: FbIcon,
      color: '#1877F2',
      bg: 'from-[#1877F2]/15 to-[#1877F2]/10',
      borderColor: 'border-[#1877F2]/20',
      textColor: 'text-[#1877F2]'
    }
  }
  if (keyLower.includes('_ok')) {
    return {
      icon: OkIcon,
      color: '#F97400',
      bg: 'from-[#F97400]/15 to-[#F97400]/10',
      borderColor: 'border-[#F97400]/20',
      textColor: 'text-[#F97400]'
    }
  }
  if (keyLower.includes('_threads')) {
    return {
      icon: ThreadsIcon,
      color: '#000000',
      bg: 'from-zinc-500/15 to-zinc-600/10',
      borderColor: 'border-zinc-500/20',
      textColor: 'text-zinc-900 dark:text-zinc-100'
    }
  }
  if (keyLower.includes('_x')) {
    return {
      icon: XIcon,
      color: '#000000',
      bg: 'from-zinc-500/15 to-zinc-600/10',
      borderColor: 'border-zinc-500/20',
      textColor: 'text-zinc-900 dark:text-zinc-100'
    }
  }
  if (keyLower.includes('_site')) {
    return {
      icon: Globe,
      color: '#10b981',
      bg: 'from-emerald-500/15 to-emerald-600/10',
      borderColor: 'border-emerald-500/20',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    }
  }

  // Default для системных промптов
  return {
    icon: FileText,
    color: '#3B82F6',
    bg: 'from-blue-500/15 to-blue-600/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400'
  }
}

// --- Sortable Item Component ---
interface PromptCardProps {
  prompt: any
  editedContent: string
  isEdited: boolean
  isSaving: boolean
  onSave: (id: any, content: string) => void
  onChange: (id: any, content: string) => void
  mounted: boolean
  isFirst?: boolean
}

function SortablePromptCard({ prompt, editedContent, isEdited, isSaving, onSave, onChange, mounted, isFirst }: PromptCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: prompt.id })

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const { icon: Icon, color, bg, borderColor, textColor } = getSocialConfig(prompt.key)

  // Auto-resize textarea with jumping prevention
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      // Temporarily disable body scroll to prevent "jumping" in some browsers (like Yandex/Chrome)
      // while recalculating layout
      const originalOverflow = document.body.style.overflow
      const scrollY = window.scrollY

      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`

      // Ensure we stay at the same position
      window.scrollTo(0, scrollY)
      document.body.style.overflow = originalOverflow
    }
  }, [editedContent])

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-tutorial={isFirst ? "prompts-card" : undefined}
      className="bg-card backdrop-blur rounded-xl border-2 border-border/60 hover:border-primary/50 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 group"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-border/60 bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            data-tutorial={isFirst ? "prompts-card-handle" : undefined}
            className="p-2.5 hover:bg-primary/10 rounded-lg cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          <div className={`p-2.5 bg-gradient-to-br ${bg} rounded-lg border ${borderColor} shadow-sm`}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <h3 className={`font-bold text-lg ${textColor} flex items-center gap-2`}>
              {prompt.key}
              {isEdited && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full border border-amber-500/30">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                  Не сохранено
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Обновлено:{' '}
              {mounted && prompt.updated_at
                ? new Date(prompt.updated_at).toLocaleString('ru-RU')
                : 'Никогда'}
            </p>
          </div>
        </div>

        <Button
          onClick={() => onSave(prompt.id, editedContent)}
          disabled={!isEdited || isSaving}
          data-tutorial={isFirst ? "prompts-card-save" : undefined}
          className={`
            transition-all duration-200 px-5 py-2 h-10 font-semibold shadow-sm
            ${isEdited
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:scale-105'
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            }
          `}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Сохранение...' : isEdited ? 'Сохранить' : 'Сохранено'}
        </Button>
      </div>


      <div className="p-6 bg-gradient-to-br from-background to-muted/10">
        <textarea
          ref={textareaRef}
          data-tutorial={isFirst ? "prompts-card-editor" : undefined}
          className="
            w-full
            min-h-[200px]
            bg-background/80
            text-foreground
            p-4
            text-sm
            font-mono
            leading-relaxed
            rounded-lg
            border-2 border-border/60
            focus:border-primary
            focus:ring-4
            focus:ring-primary/20
            focus:outline-none
            transition-all
            duration-200
            resize-none
            placeholder:text-muted-foreground
            shadow-inner
          "
          value={editedContent}
          onChange={(e) => onChange(prompt.id, e.target.value)}
          placeholder="Введите системный промпт..."
          spellCheck={false}
        />

        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {editedContent.length} символов
          </p>

          {isEdited && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium px-2.5 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              Несохраненные изменения
            </p>
          )}
        </div>
      </div>
    </div >
  )
}

function PromptsContent() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const router = useRouter()

  const [prompts, setPrompts] = useState<any[]>([])
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  const defaultTab = searchParams.get('tab') || 'system'
  const [activeTab, setActiveTab] = useState(defaultTab)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )



  // Categorize prompts
  const systemPrompts = useMemo(() => prompts.filter(p => p.category === 'system' || !p.category), [prompts])
  const newsPrompts = useMemo(() => prompts.filter(p => p.category === 'news'), [prompts])
  const reviewsPrompts = useMemo(() => prompts.filter(p => p.category === 'reviews'), [prompts])
  const socialPrompts = useMemo(() => prompts.filter(p => p.category === 'social'), [prompts])

  const fetchPrompts = useCallback(async () => {
    const { data: promptsData, error: promptsError } = await (supabase as any)
      .from('system_prompts')
      .select('id, key, content, category, updated_at')

    if (promptsError) {
      toast.error('Не удалось загрузить промпты')
      return
    }

    const { data: settingsData } = await supabase
      .from('project_settings')
      .select('value')
      .eq('project_key', 'ainews')
      .eq('key', 'prompts_order')
      .single()

    let orderedPrompts = promptsData as any[]
    const settings = settingsData as any

    if (settings?.value) {
      try {
        const orderIds = JSON.parse(settings.value) as string[]
        orderedPrompts.sort((a, b) => {
          const indexA = orderIds.indexOf(String(a.id))
          const indexB = orderIds.indexOf(String(b.id))
          if (indexA !== -1 && indexB !== -1) return indexA - indexB
          if (indexA !== -1) return -1
          if (indexB !== -1) return 1
          return a.key.localeCompare(b.key)
        })
      } catch (e) {
        console.error('Failed to parse prompts order', e)
      }
    } else {
      orderedPrompts.sort((a, b) => a.key.localeCompare(b.key))
    }

    setPrompts(orderedPrompts)
  }, [supabase])

  useEffect(() => {
    setMounted(true)
    fetchPrompts()
  }, [fetchPrompts])

  // Синхронизируем activeTab с URL
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['system', 'news', 'reviews', 'social'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    router.push(`/prompts?tab=${value}`, { scroll: false })
  }, [router])

  const promptsTutorialSteps = useMemo(() => getPromptsTutorialSteps(handleTabChange), [handleTabChange])

  const handleChange = (id: any, content: string) => {
    setEditedPrompts(prev => ({ ...prev, [String(id)]: content }))
  }

  const save = async (id: any, content: string) => {
    const idStr = String(id)
    setSaving(prev => ({ ...prev, [idStr]: true }))

    const now = new Date().toISOString()
    const { error } = await (supabase as any)
      .from('system_prompts')
      .update({ content, updated_at: now } as any)
      .eq('id', id)

    if (error) {
      toast.error('Не удалось сохранить промпт')
      setSaving(prev => ({ ...prev, [idStr]: false }))
      return
    }

    toast.success('Промпт успешно сохранен')

    setPrompts(prev =>
      prev.map(p => (String(p.id) === idStr ? { ...p, content, updated_at: now } : p))
    )

    setEditedPrompts(prev => {
      const next = { ...prev }
      delete next[idStr]
      return next
    })

    setSaving(prev => ({ ...prev, [idStr]: false }))
  }

  const hasChanges = (id: any) => editedPrompts[String(id)] !== undefined

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setPrompts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        const newItems = arrayMove(items, oldIndex, newIndex)
        const newOrderIds = newItems.map(i => String(i.id))

        supabase
          .from('project_settings')
          .upsert({
            project_key: 'ainews',
            key: 'prompts_order',
            value: JSON.stringify(newOrderIds),
            is_active: true
          } as any)
          .then(({ error }) => {
            if (error) toast.error('Не удалось сохранить порядок')
          })

        return newItems
      })
    }
  }

  const renderPrompts = (promptsList: any[]) => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={promptsList.map(p => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid gap-6">
          {promptsList.map((p, index) => {
            const idStr = String(p.id)
            const currentValue = editedPrompts[idStr] ?? p.content ?? ''
            const isEdited = hasChanges(p.id)
            const isSaving = !!saving[idStr]

            return (
              <SortablePromptCard
                key={idStr}
                prompt={p}
                editedContent={currentValue}
                isEdited={isEdited}
                isSaving={isSaving}
                onSave={save}
                onChange={handleChange}
                mounted={mounted}
                isFirst={index === 0}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto relative">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div data-tutorial="prompts-header" className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">System Prompts</h1>
            <p className="text-muted-foreground text-sm">
              Управление промптами для генерации и адаптации контента
            </p>
          </div>
          <TutorialButton label="Помощь" steps={promptsTutorialSteps} variant="outline" className="h-9 px-4 rounded-full" />
        </div>

        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 -mx-4 sm:-mx-6 px-4 sm:px-6 mb-6 border-b shadow-sm transition-all">
          <TabsList data-tutorial="prompts-tabs" className="grid w-full grid-cols-4 h-11 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="system" className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all font-medium">Системные</TabsTrigger>
            <TabsTrigger value="news" className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all font-medium">Новости</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all font-medium">Обзоры</TabsTrigger>
            <TabsTrigger value="social" className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all font-medium">Соцсети</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="system" className="mt-6">
          {systemPrompts.length > 0 ? (
            renderPrompts(systemPrompts)
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Нет системных промптов</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="news" className="mt-6">
          {newsPrompts.length > 0 ? (
            renderPrompts(newsPrompts)
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Нет промптов для новостей</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          {reviewsPrompts.length > 0 ? (
            renderPrompts(reviewsPrompts)
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Нет промптов для обзоров</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="social" className="mt-6">
          {socialPrompts.length > 0 ? (
            renderPrompts(socialPrompts)
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Нет промптов для соцсетей</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function PromptsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <PromptsContent />
    </Suspense>
  )
}
