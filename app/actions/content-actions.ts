'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContentStats, ContentFilter } from '@/types/content'
import type { Database } from '@/types/database.types'
import type { ContentActionResult } from '@/types/content-actions'

const STALE_ERROR = { code: 'STALE_DATA', message: 'Already processed' } as const



export async function getContentStats(): Promise<ContentStats> {
    const adminDb = createAdminClient()

    try {
        const [totalResult, pendingResult, approvedResult, rejectedResult] = await Promise.all([
            // Total
            adminDb
                .from('news_items')
                .select('*', { count: 'exact', head: true }),

            // Pending (gate1 passed, no decision) - Match UI logic precisely
            adminDb
                .from('news_items')
                .select('*', { count: 'exact', head: true })
                .neq('gate1_decision', null)
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

        // Log errors if present
        if (totalResult.error) console.error('[Stats] Total Error:', totalResult.error)
        if (pendingResult.error) console.error('[Stats] Pending Error:', pendingResult.error)
        if (approvedResult.error) console.error('[Stats] Approved Error:', approvedResult.error)
        if (rejectedResult.error) console.error('[Stats] Rejected Error:', rejectedResult.error)

        return {
            total: totalResult.count || 0,
            pending: pendingResult.count || 0,
            approved: approvedResult.count || 0,
            rejected: rejectedResult.count || 0
        }
    } catch (error) {
        console.error('[Action] getContentStats exception:', error)
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
        // 1. Mark as 'processing' (hide from Pending list, keep out of Approved list)
        const { data, error, count } = await ((adminDb
            .from('news_items') as any)
            .update({
                approve1_decision: 'processing',
                approve1_decided_at: new Date().toISOString(),
                approve1_decided_by: userId,
                status: 'approved_for_adaptation'
            }, { count: 'exact' })
            .eq('id', newsId)
            // .is('approve1_decision', null) // Relax condition if we retry? No, stick to raw.
            .is('approve1_decision', null)
            .select() as any)

        if (error) {
            console.error('Error approving content:', error)
            return { success: false, error: { code: 'SUPABASE_ERROR', message: error.message } }
        }

        if (!count || !data || data.length === 0) {
            return { success: false, error: STALE_ERROR }
        }

        // 2. Run Generation (Wait for completion)
        const { processApprovedNews } = await import('@/lib/generation-service')

        try {
            await processApprovedNews(newsId)

            // 3. SUCCESS: Mark as truly approved
            await ((adminDb
                .from('news_items') as any)
                .update({ approve1_decision: 'approved' })
                .eq('id', newsId) as any)

        } catch (genError: any) {
            console.error(`[ContentAction] Error processing news ${newsId}:`, genError)

            // 4. ERROR: Revert to Pending
            await ((adminDb
                .from('news_items') as any)
                .update({
                    approve1_decision: null,
                    status: 'error',
                    gate1_reason: `Generation Error: ${genError.message}`
                })
                .eq('id', newsId) as any)

            const errorMsg = genError instanceof Error ? genError.message : String(genError)
            return {
                success: false,
                error: { code: 'GENERATION_ERROR', message: `Ошибка генерации: ${errorMsg}` }
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
            .is('approve1_decision', null)
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

export async function markContentViewed(newsId: string): Promise<ContentActionResult> {
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
        // query = query.neq('gate1_decision', null) // Removed to include raw items
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
