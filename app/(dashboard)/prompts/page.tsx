'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save, FileText } from 'lucide-react'

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<any[]>([])
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  const fetch = async () => {
    const { data } = await supabase.from('system_prompts').select('*').order('key')
    if (data) setPrompts(data)
  }

  useEffect(() => { fetch() }, [])

  const handleChange = (id: any, content: string) => {
    setEditedPrompts(prev => ({ ...prev, [id]: content }))
  }

  const save = async (id: any, content: string) => {
    setSaving(prev => ({ ...prev, [id]: true }))
    const { error } = await supabase.from('system_prompts').update({
      content
    }).eq('id', id)

    if (error) {
      toast.error('Failed to save prompt')
    } else {
      toast.success('Prompt saved successfully')
      // Update local prompts state
      setPrompts(prev => prev.map(p =>
        p.id === id ? { ...p, content } : p
      ))
      // Remove from edited list
      setEditedPrompts(prev => {
        const newState = { ...prev }
        delete newState[id]
        return newState
      })
    }
    setSaving(prev => ({ ...prev, [id]: false }))
  }

  const hasChanges = (id: any) => editedPrompts[id] !== undefined

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">System Prompts</h1>
        <p className="text-zinc-400 text-sm">
          Manage AI system prompts for content generation
        </p>
      </div>

      {/* Prompts Grid */}
      <div className="grid gap-6">
        {prompts.map(p => {
          const currentValue = editedPrompts[p.id] ?? p.content
          const isEdited = hasChanges(p.id)
          const isSaving = saving[p.id]

          return (
            <div
              key={p.id}
              className="bg-zinc-900/50 backdrop-blur rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all duration-200 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-blue-400">
                      {p.key}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Last updated: {p.updated_at ? new Date(p.updated_at).toLocaleString('ru-RU') : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={() => save(p.id, currentValue)}
                  disabled={!isEdited || isSaving}
                  className={`
                    transition-all duration-200 px-4 py-2 h-9
                    ${isEdited
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : isEdited ? 'Save Changes' : 'Saved'}
                </Button>
              </div>

              {/* Content */}
              <div className="p-6">
                <textarea
                  className="
                    w-full h-64 
                    bg-zinc-950/50 
                    text-zinc-100
                    p-4 
                    text-sm 
                    font-mono 
                    rounded-lg
                    border border-zinc-800 
                    focus:border-blue-500 
                    focus:ring-2 
                    focus:ring-blue-500/20
                    focus:outline-none
                    transition-all
                    duration-200
                    resize-y
                    placeholder:text-zinc-600
                  "
                  value={currentValue}
                  onChange={(e) => handleChange(p.id, e.target.value)}
                  placeholder="Enter system prompt..."
                  spellCheck={false}
                />

                {/* Footer Info */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-zinc-500">
                    {currentValue?.length || 0} characters
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
