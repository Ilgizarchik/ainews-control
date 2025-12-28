'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { useRealtime } from '@/hooks/useRealtime'

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
  useRealtime('publish_recipes', fetchRecipes)

  const handleSetMain = async (id: string, currentIsMain: boolean, isActive: boolean) => {
    if (currentIsMain) return toast.error('Already Main.')
    if (!isActive) return toast.error('Main platform must be active.')
    const { error } = await supabase.rpc('set_main_recipe', { target_id: id })
    if (error) toast.error(error.message)
    else { toast.success('Main updated'); fetchRecipes(); }
  }

  const handleToggleActive = async (id: string, newState: boolean) => {
    const { error } = await supabase.rpc('toggle_recipe_active', { target_id: id, new_state: newState })
    if (error) toast.error(error.message)
    else { toast.success('Status updated'); fetchRecipes(); }
  }

  const handleUpdateDelay = async (id: string, delay: number) => {
    const { error } = await supabase.from('publish_recipes').update({ delay_hours: delay }).eq('id', id)
    if (error) toast.error('Failed')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Publishing Recipes</h1>
      <div className="grid gap-4">
        {loading ? <p>Loading...</p> : recipes.map(r => (
          <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div className="w-24 font-bold uppercase">{r.platform}</div>
               {r.is_main && <Badge className="bg-blue-600">MAIN</Badge>}
            </div>
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-zinc-500">Active</span>
                <Switch checked={r.is_active} onCheckedChange={(val) => handleToggleActive(r.id, val)} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-zinc-500">Is Main</span>
                <Switch checked={r.is_main} onCheckedChange={() => handleSetMain(r.id, r.is_main, r.is_active)} disabled={r.is_main || !r.is_active} />
              </div>
              <div className="w-24">
                 <Input type="number" min="0" value={r.delay_hours} onChange={(e) => handleUpdateDelay(r.id, parseFloat(e.target.value))} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
