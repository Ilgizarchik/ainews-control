'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getSystemPrompts() {
    try {
        // Validate caller session first, then use admin client to avoid RLS-empty reads.
        const sessionClient = await createClient()
        const { data: { user }, error: userError } = await sessionClient.auth.getUser()
        if (userError || !user) {
            throw new Error('Unauthorized')
        }

        const adminDb = createAdminClient()
        const { data, error } = await adminDb
            .from('system_prompts')
            .select('*')
            .neq('key', 'parse_date')
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
        const sessionClient = await createClient()
        const { data: { user }, error: userError } = await sessionClient.auth.getUser()
        if (userError || !user) {
            throw new Error('Unauthorized')
        }

        const adminDb = createAdminClient()
        const { error } = await adminDb
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
