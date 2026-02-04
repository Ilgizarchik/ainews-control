'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContentItem, ContentStats, ContentFilter } from '@/types/content'
import type { Database } from '@/types/database.types'
import type { ContentActionResult } from '@/types/content-actions'

const APPROVE1_PENDING_STATUS: Database['public']['Enums']['news_status'] = 'found'
const STALE_ERROR = { code: 'STALE_DATA', message: 'Already processed' } as const



export async function getContentStats(): Promise<ContentStats> {
    const adminDb = createAdminClient()

    try {
        const [totalResult, pendingResult, approvedResult, rejectedResult] = await Promise.all([
            // Total
            adminDb
                .from('news_items')
                .select('*', { count: 'exact', head: true }),

            // Pending (gate1 passed, no decision)
            adminDb
                .from('news_items')
                .select('*', { count: 'exact', head: true })
                .eq('gate1_decision', 'send')
                .is('approve1_decision', null),

            // Approved
            adminDb
                .from('news_items')
                .select('*', { count: 'exact', head: true })
                .eq('approve1_decision', 'approved'),

            // Rejected
            adminDb
                .from('news_items')
                .select('*', { count: 'exact', head: true })
                .eq('approve1_decision', 'rejected')
        ])

        return {
            total: totalResult.count || 0,
            pending: pendingResult.count || 0,
            approved: approvedResult.count || 0,
            rejected: rejectedResult.count || 0
        }
    } catch (error) {
        console.error('[Action] getContentStats error:', error)
        return { total: 0, pending: 0, approved: 0, rejected: 0 }
    }
}


export async function approveContentItem(
    newsId: string,
    userIdArg: string = 'dashboard'
): Promise<ContentActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || userIdArg

    // Use admin client for DB operations to bypass RLS
    const adminDb = createAdminClient()

    try {
        // 1. Сначала помечаем как одобренное модератором (Gate 1)
        const { data, error, count } = await ((adminDb
            .from('news_items') as any)
            .update({
                approve1_decision: 'approved',
                approve1_decided_at: new Date().toISOString(),
                approve1_decided_by: userId,
                status: 'approved_for_adaptation'
            }, { count: 'exact' })
            .eq('id', newsId)
            .eq('status', APPROVE1_PENDING_STATUS)
            .select() as any)

        if (error) {
            console.error('Error approving content:', error)
            return { success: false, error: { code: 'SUPABASE_ERROR', message: error.message } }
        }

        if (!count) {
            return { success: false, error: STALE_ERROR }
        }

        if (!data || data.length === 0) {
            return { success: false, error: STALE_ERROR }
        }

        // 2. Запускаем логику генерации черновиков и ЖДЁМ завершения
        const { processApprovedNews } = await import('@/lib/generation-service')

        try {
            console.log(`[ContentAction] Waiting for generation... ${newsId}`)
            await processApprovedNews(newsId)
            console.log(`[ContentAction] Generation complete for ${newsId}`)
        } catch (genError) {
            console.error(`[ContentAction] Error processing news ${newsId}:`, genError)
            return {
                success: false,
                error: { code: 'GENERATION_ERROR', message: `Ошибка генерации: ${genError}` }
            }
        }

        const { revalidatePath } = await import('next/cache')
        revalidatePath('/content')

        return { success: true, message: 'Новость одобрена, контент сгенерирован' }
    } catch (error: any) {
        console.error('Error in approveContentItem:', error)
        return { success: false, error: { code: 'UNKNOWN_ERROR', message: error.message || 'Unknown error' } }
    }
}



export async function rejectContentItem(
    newsId: string,
    userIdArg: string = 'dashboard'
): Promise<ContentActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || userIdArg

    // Use admin client for DB operations to bypass RLS
    const adminDb = createAdminClient()

    try {
        const { data, error, count } = await ((adminDb
            .from('news_items') as any)
            .update({
                approve1_decision: 'rejected',
                approve1_decided_at: new Date().toISOString(),
                approve1_decided_by: userId,
                status: 'rejected'
            }, { count: 'exact' })
            .eq('id', newsId)
            .eq('status', APPROVE1_PENDING_STATUS)
            .select() as any)

        if (error) {
            console.error('Error rejecting content:', error)
            return { success: false, error: { code: 'SUPABASE_ERROR', message: error.message } }
        }

        if (!count) {
            return { success: false, error: STALE_ERROR }
        }

        if (!data || data.length === 0) {
            return { success: false, error: STALE_ERROR }
        }

        const { revalidatePath } = await import('next/cache')
        revalidatePath('/content')

        return { success: true, data: data[0] }
    } catch (error: any) {
        console.error('Error in rejectContentItem:', error)
        return { success: false, error: { code: 'UNKNOWN_ERROR', message: error.message || 'Unknown error' } }
    }
}

export async function markContentViewed(
    newsId: string,
    userIdArg: string = 'dashboard'
): Promise<ContentActionResult> {
    const adminDb = createAdminClient()
    try {
        const { error } = await ((adminDb
            .from('news_items') as any)
            .update({ is_viewed: true })
            .eq('id', newsId) as any)

        if (error) {
            console.error('Error marking viewed:', error)
            return { success: false, error: { code: 'SUPABASE_ERROR', message: error.message } }
        }

        return { success: true }
    } catch (e: any) {
        return { success: false, error: { code: 'UNKNOWN_ERROR', message: e.message || 'Unknown error' } }
    }
}

export async function getContentStatsBySource(filter: ContentFilter = 'pending'): Promise<{ source: string, count: number }[]> {
    const adminDb = createAdminClient()

    let query = (adminDb.from('news_items' as any) as any).select('source_name')

    if (filter === 'pending') {
        query = query.eq('gate1_decision', 'send').is('approve1_decision', null)
    } else if (filter === 'approved') {
        query = query.eq('approve1_decision', 'approved')
    } else if (filter === 'rejected') {
        query = query.eq('approve1_decision', 'rejected')
    } else {
        query = query.neq('gate1_decision', null)
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(10000) // Increase limit to ensure we count more items (Postgrest default is 1000)

    if (error || !data) {
        console.error('Error fetching source stats:', error)
        return []
    }

    const counts: Record<string, number> = {}
    data.forEach((item: any) => {
        const src = item.source_name || 'Неизвестно'
        counts[src] = (counts[src] || 0) + 1
    })

    return Object.entries(counts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
}
