'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const PROJECT_KEY = 'ainews'

async function requireSession() {
    const sessionClient = await createClient()
    const { data: { user }, error } = await sessionClient.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

export async function getProjectSettings() {
    try {
        await requireSession()
        const adminDb = createAdminClient()
        const { data, error } = await adminDb
            .from('project_settings')
            .select('*')
            .eq('project_key', PROJECT_KEY)

        if (error) throw error
        return { success: true, data: data ?? [] }
    } catch (e: any) {
        console.error('[getProjectSettings]', e)
        return { success: false, error: e.message, data: [] }
    }
}

export async function saveProjectSettings(rows: Array<{ key: string; value: string }>) {
    try {
        await requireSession()
        const adminDb = createAdminClient()

        const upsertRows = rows.map(r => ({
            project_key: PROJECT_KEY,
            key: r.key,
            value: r.value,
            is_active: true,
        }))

        const { error } = await adminDb
            .from('project_settings')
            .upsert(upsertRows as any, { onConflict: 'project_key,key' })

        if (error) throw error
        revalidatePath('/settings')
        return { success: true }
    } catch (e: any) {
        console.error('[saveProjectSettings]', e)
        return { success: false, error: e.message }
    }
}

export async function saveSingleProjectSetting(key: string, value: string) {
    try {
        await requireSession()
        const adminDb = createAdminClient()

        const { error } = await adminDb
            .from('project_settings')
            .upsert(
                { project_key: PROJECT_KEY, key, value, is_active: true } as any,
                { onConflict: 'project_key,key' }
            )

        if (error) throw error
        return { success: true }
    } catch (e: any) {
        console.error('[saveSingleProjectSetting]', e)
        return { success: false, error: e.message }
    }
}

// --- Recipes ---

export async function getPublishRecipes() {
    try {
        await requireSession()
        const adminDb = createAdminClient()

        const [recipesRes, orderRes] = await Promise.all([
            adminDb.from('publish_recipes').select('*'),
            adminDb
                .from('project_settings')
                .select('value')
                .eq('project_key', PROJECT_KEY)
                .eq('key', 'recipes_order')
                .maybeSingle(),
        ])

        if (recipesRes.error) throw recipesRes.error

        let recipes = (recipesRes.data ?? []) as any[]
        const orderValue = (orderRes.data as any)?.value

        if (orderValue) {
            try {
                const orderIds = JSON.parse(orderValue) as string[]
                recipes = [...recipes].sort((a, b) => {
                    const ia = orderIds.indexOf(String(a.id))
                    const ib = orderIds.indexOf(String(b.id))
                    if (ia !== -1 && ib !== -1) return ia - ib
                    if (ia !== -1) return -1
                    if (ib !== -1) return 1
                    return a.platform.localeCompare(b.platform)
                })
            } catch { recipes.sort((a, b) => a.platform.localeCompare(b.platform)) }
        } else {
            recipes.sort((a, b) => a.platform.localeCompare(b.platform))
        }

        return { success: true, data: recipes }
    } catch (e: any) {
        console.error('[getPublishRecipes]', e)
        return { success: false, error: e.message, data: [] }
    }
}

export async function setMainRecipe(id: string) {
    try {
        await requireSession()
        const adminDb = createAdminClient()
        const { error } = await adminDb.rpc('set_main_recipe', { target_id: id } as any)
        if (error) throw error
        revalidatePath('/recipes')
        return { success: true }
    } catch (e: any) {
        console.error('[setMainRecipe]', e)
        return { success: false, error: e.message }
    }
}

export async function toggleRecipeActive(id: string, newState: boolean) {
    try {
        await requireSession()
        const adminDb = createAdminClient()
        const { error } = await adminDb.rpc('toggle_recipe_active', { target_id: id, new_state: newState } as any)
        if (error) throw error
        revalidatePath('/recipes')
        return { success: true }
    } catch (e: any) {
        console.error('[toggleRecipeActive]', e)
        return { success: false, error: e.message }
    }
}

export async function updateRecipeDelay(id: string, delay: number) {
    try {
        await requireSession()
        const adminDb = createAdminClient()
        const { error } = await adminDb
            .from('publish_recipes')
            .update({ delay_hours: delay } as any)
            .eq('id', id)
        if (error) throw error
        revalidatePath('/recipes')
        return { success: true }
    } catch (e: any) {
        console.error('[updateRecipeDelay]', e)
        return { success: false, error: e.message }
    }
}

export async function saveRecipesOrder(orderIds: string[]) {
    try {
        await requireSession()
        const adminDb = createAdminClient()
        const { error } = await adminDb
            .from('project_settings')
            .upsert(
                { project_key: PROJECT_KEY, key: 'recipes_order', value: JSON.stringify(orderIds), is_active: true } as any,
                { onConflict: 'project_key,key' }
            )
        if (error) throw error
        return { success: true }
    } catch (e: any) {
        console.error('[saveRecipesOrder]', e)
        return { success: false, error: e.message }
    }
}

// --- AI Correction Logs ---

export async function getAiCorrectionLogs(limit = 50) {
    try {
        await requireSession()
        const adminDb = createAdminClient()
        const { data, error } = await (adminDb as any)
            .from('ai_correction_logs')
            .select(`
                *,
                news_items (draft_title, title),
                review_items (draft_title)
            `)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return { success: true, data: data ?? [] }
    } catch (e: any) {
        console.error('[getAiCorrectionLogs]', e)
        return { success: false, error: e.message, data: [] }
    }
}
