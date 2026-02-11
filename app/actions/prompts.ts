'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getSystemPrompt(key: string) {
    const supabaseAdmin = createAdminClient()
    console.log(`[Prompts] Fetching prompt for key: ${key}`)

    try {
        // Используем .like, чтобы учесть возможные пробелы в ключах
        const { data, error } = await supabaseAdmin
            .from('system_prompts')
            .select('content, key')
            .like('key', `${key}%`)
            .limit(1)

        if (error) {
            console.error(`[Prompts] Error fetching prompt ${key}:`, error)
            return null
        }

        if (!data || data.length === 0) {
            console.warn(`[Prompts] No prompt found for key matching prefix: ${key}`)
            return null
        }

        return { content: (data[0] as any).content, fullKey: (data[0] as any).key }
    } catch (e) {
        console.error(`[Prompts] Unexpected error in getSystemPrompt:`, e)
        return null
    }
}

export async function updateSystemPrompt(key: string, content: string) {
    const supabaseAdmin = createAdminClient()

    // 1. Сначала берем точный ключ (чтобы корректно обработать пробелы при обновлении)
    const { data: existing } = await supabaseAdmin
        .from('system_prompts')
        .select('key')
        .like('key', `${key}%`)
        .limit(1)
        .maybeSingle()

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
