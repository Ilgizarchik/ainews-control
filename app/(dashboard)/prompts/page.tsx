'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save, FileText, GripVertical } from 'lucide-react'
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

// --- Sortable Item Component ---
interface PromptCardProps {
  prompt: any
  editedContent: string
  isEdited: boolean
  isSaving: boolean
  onSave: (id: any, content: string) => void
  onChange: (id: any, content: string) => void
  mounted: boolean
}

function SortablePromptCard({ prompt, editedContent, isEdited, isSaving, onSave, onChange, mounted }: PromptCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: prompt.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card backdrop-blur rounded-xl border-2 border-border/60 hover:border-primary/50 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 group"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-border/60 bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="p-2.5 hover:bg-primary/10 rounded-lg cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="p-2.5 bg-gradient-to-br from-blue-500/15 to-blue-600/10 rounded-lg border border-blue-500/20 shadow-sm">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400 flex items-center gap-2">
              {prompt.key}
              {isEdited && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full border border-amber-500/30">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                  Unsaved
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Last updated:{' '}
              {mounted && prompt.updated_at
                ? new Date(prompt.updated_at).toLocaleString('ru-RU')
                : 'Never'}
            </p>
          </div>
        </div>

        <Button
          onClick={() => onSave(prompt.id, editedContent)}
          disabled={!isEdited || isSaving}
          className={`
            transition-all duration-200 px-5 py-2 h-10 font-semibold shadow-sm
            ${isEdited
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:scale-105'
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            }
          `}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : isEdited ? 'Save Changes' : 'Saved'}
        </Button>
      </div>

      <div className="p-6 bg-gradient-to-br from-background to-muted/10">
        <textarea
          className="
            w-full h-64
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
            resize-y
            placeholder:text-muted-foreground
            shadow-inner
          "
          value={editedContent}
          onChange={(e) => onChange(prompt.id, e.target.value)}
          placeholder="Enter system prompt..."
          spellCheck={false}
        />

        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {editedContent.length} characters
          </p>

          {isEdited && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium px-2.5 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              Unsaved changes
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PromptsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [prompts, setPrompts] = useState<any[]>([])
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchPrompts = useCallback(async () => {
    // 1. Fetch prompts
    const { data: promptsData, error: promptsError } = await (supabase as any)
      .from('system_prompts')
      .select('*')

    if (promptsError) {
      toast.error('Failed to load prompts')
      return
    }

    // 2. Fetch order
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
        // Sort prompts based on the order array
        orderedPrompts.sort((a, b) => {
          const indexA = orderIds.indexOf(String(a.id))
          const indexB = orderIds.indexOf(String(b.id))
          // If both are in the list, sort by index
          if (indexA !== -1 && indexB !== -1) return indexA - indexB
          // If only A is in the list, A comes first
          if (indexA !== -1) return -1
          // If only B is in the list, B comes first
          if (indexB !== -1) return 1
          // If neither, keep original order (or sort by key/id)
          return a.key.localeCompare(b.key)
        })
      } catch (e) {
        console.error('Failed to parse prompts order', e)
      }
    } else {
      // Default sort by key if no order saved
      orderedPrompts.sort((a, b) => a.key.localeCompare(b.key))
    }

    setPrompts(orderedPrompts)
  }, [supabase])

  useEffect(() => {
    setMounted(true)
    fetchPrompts()
  }, [fetchPrompts])

  const handleChange = (id: any, content: string) => {
    setEditedPrompts(prev => ({ ...prev, [String(id)]: content }))
  }

  const save = async (id: any, content: string) => {
    const idStr = String(id)
    setSaving(prev => ({ ...prev, [idStr]: true }))

    const { error } = await (supabase as any)
      .from('system_prompts')
      .update({ content } as any)
      .eq('id', id)

    if (error) {
      toast.error('Failed to save prompt')
      setSaving(prev => ({ ...prev, [idStr]: false }))
      return
    }

    toast.success('Prompt saved successfully')

    setPrompts(prev =>
      prev.map(p => (String(p.id) === idStr ? { ...p, content } : p))
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

        // Save new order
        const newOrderIds = newItems.map(i => String(i.id))

        // Persist to project_settings
        supabase
          .from('project_settings')
          .upsert({
            project_key: 'ainews',
            key: 'prompts_order',
            value: JSON.stringify(newOrderIds),
            is_active: true
          } as any)
          .then(({ error }) => {
            if (error) toast.error('Failed to save order')
          })

        return newItems
      })
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">System Prompts</h1>
        <p className="text-muted-foreground text-sm">
          Manage AI system prompts for content generation. Drag to reorder.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={prompts.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-6">
            {prompts.map(p => {
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
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {prompts.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No prompts found</p>
          <p className="text-sm">Add prompts to your database to get started</p>
        </div>
      )}
    </div>
  )
}
