'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getSystemPrompt(key: string) {
    const supabaseAdmin = createAdminClient()

    // Use .like to handle potential whitespace issues we saw earlier
    const { data, error } = await supabaseAdmin
        .from('system_prompts')
        .select('content, key')
        .like('key', `${key}%`)
        .limit(1)
        .single()

    if (error) {
        console.error(`Error fetching prompt ${key}:`, error)
        return null
    }

    return { content: (data as any).content, fullKey: (data as any).key }
}

export async function updateSystemPrompt(key: string, content: string) {
    const supabaseAdmin = createAdminClient()

    // 1. Fetch exact key first (to handle the whitespace issue correctly on update)
    const { data: existing } = await supabaseAdmin
        .from('system_prompts')
        .select('key')
        .like('key', `${key}%`)
        .limit(1)
        .single()

    const targetKey = (existing as any)?.key || key

    const { error } = await supabaseAdmin
        .from('system_prompts')
        // @ts-ignore
        .update({ content })
        .eq('key', targetKey)

    if (error) throw error

    revalidatePath('/publications')
    return { success: true }
}
