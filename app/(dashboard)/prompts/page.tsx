'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save, FileText } from 'lucide-react'

export default function PromptsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [prompts, setPrompts] = useState<any[]>([])
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const fetchPrompts = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('system_prompts')
      .select('*')
      .order('key')

    if (error) {
      toast.error('Failed to load prompts')
      return
    }
    if (data) setPrompts(data as any[])
  }, [supabase])

  const [mounted, setMounted] = useState(false)
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">System Prompts</h1>
        <p className="text-muted-foreground text-sm">
          Manage AI system prompts for content generation
        </p>
      </div>

      <div className="grid gap-6">
        {prompts.map(p => {
          const idStr = String(p.id)
          const currentValue = editedPrompts[idStr] ?? p.content ?? ''
          const isEdited = hasChanges(p.id)
          const isSaving = !!saving[idStr]

          return (
            <div
              key={idStr}
              className="bg-card backdrop-blur rounded-lg border border-border hover:border-accent transition-all duration-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
                      {p.key}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Last updated:{' '}
                      {mounted && p.updated_at
                        ? new Date(p.updated_at).toLocaleString('ru-RU')
                        : 'Never'}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => save(p.id, currentValue)}
                  disabled={!isEdited || isSaving}
                  className={`
                    transition-all duration-200 px-4 py-2 h-9
                    ${isEdited
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }
                  `}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : isEdited ? 'Save Changes' : 'Saved'}
                </Button>
              </div>

              <div className="p-6">
                <textarea
                  className="
                    w-full h-64
                    bg-muted/30
                    text-foreground
                    p-4
                    text-sm
                    font-mono
                    rounded-lg
                    border border-border
                    focus:border-primary
                    focus:ring-2
                    focus:ring-primary/20
                    focus:outline-none
                    transition-all
                    duration-200
                    resize-y
                    placeholder:text-muted-foreground
                  "
                  value={currentValue}
                  onChange={(e) => handleChange(p.id, e.target.value)}
                  placeholder="Enter system prompt..."
                  spellCheck={false}
                />

                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-zinc-500">
                    {currentValue.length} characters
                  </p>

                  {isEdited && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                      Unsaved changes
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

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
