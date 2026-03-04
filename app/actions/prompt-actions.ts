'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getSystemPrompts() {
    try {
        const sessionClient = await createClient()
        const { data: { session }, error: sessionError } = await sessionClient.auth.getSession()
        if (sessionError || !session?.user) {
            throw new Error('Unauthorized')
        }

        const adminDb = createAdminClient()
        const { data, error } = await adminDb
            .from('system_prompts')
            .select('id, key, content, category, updated_at')
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
        const { data: { session }, error: sessionError } = await sessionClient.auth.getSession()
        if (sessionError || !session?.user) {
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

export async function savePromptContent(id: string | number, content: string) {
    try {
        const sessionClient = await createClient()
        const { data: { session }, error: sessionError } = await sessionClient.auth.getSession()
        if (sessionError || !session?.user) {
            throw new Error('Unauthorized')
        }

        const now = new Date().toISOString()
        const adminDb = createAdminClient()
        const { error } = await adminDb
            .from('system_prompts')
            .update({ content, updated_at: now } as any)
            .eq('id', Number(id))

        if (error) throw error
        return { success: true, updated_at: now }
    } catch (e: any) {
        console.error('[savePromptContent] Error:', e)
        return { success: false, error: e.message }
    }
}

export async function savePromptsOrder(orderIds: string[]) {
    try {
        const sessionClient = await createClient()
        const { data: { session }, error: sessionError } = await sessionClient.auth.getSession()
        if (sessionError || !session?.user) {
            throw new Error('Unauthorized')
        }

        const adminDb = createAdminClient()
        const { error } = await adminDb
            .from('project_settings')
            .upsert({
                project_key: 'ainews',
                key: 'prompts_order',
                value: JSON.stringify(orderIds),
                is_active: true
            } as any)

        if (error) throw error
        return { success: true }
    } catch (e: any) {
        console.error('[savePromptsOrder] Error:', e)
        return { success: false, error: e.message }
    }
}

export async function getPromptsOrder() {
    try {
        const sessionClient = await createClient()
        const { data: { session }, error: sessionError } = await sessionClient.auth.getSession()
        if (sessionError || !session?.user) {
            throw new Error('Unauthorized')
        }

        const adminDb = createAdminClient()
        const { data } = await adminDb
            .from('project_settings')
            .select('value')
            .eq('project_key', 'ainews')
            .eq('key', 'prompts_order')
            .single()

        return { success: true, order: (data as any)?.value ?? null }
    } catch (e: any) {
        return { success: false, order: null, error: e.message }
    }
}
