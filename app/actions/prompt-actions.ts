'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSystemPrompts() {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('system_prompts')
            .select('*')
            .order('category', { ascending: true })
            .order('key', { ascending: true })

        if (error) throw error
        return { success: true, data }
    } catch (e: any) {
        console.error('[getSystemPrompts] Error:', e)
        return { success: false, error: e.message }
    }
}

export async function updateSystemPrompt(id: number, payload: any) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('system_prompts')
            .update(payload)
            .eq('id', id)

        if (error) throw error

        revalidatePath('/settings')
        return { success: true }
    } catch (e: any) {
        console.error('[updateSystemPrompt] Error:', e)
        return { success: false, error: e.message }
    }
}
