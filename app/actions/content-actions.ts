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
        const { data, error } = await (adminDb.rpc as any)('get_content_stats_aggregated')

        if (error) {
            console.error('[Action] getContentStats RPC Error:', error)
            return { total: 0, pending: 0, approved: 0, rejected: 0 }
        }

        return data as unknown as ContentStats
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

    try {
        const { data, error } = await (adminDb.rpc as any)('get_source_stats', { filter_status: filter })

        if (error) {
            console.error('[Action] getSourceStats RPC Error:', error)
            return []
        }

        return (data as unknown as any[]).map(item => ({
            source: item.source_name,
            count: Number(item.count)
        }))
    } catch (error) {
        console.error('[Action] getSourceStats exception:', error)
        return []
    }
}
export async function fetchContentItems(
    filter: ContentFilter,
    sources: string[],
    page: number = 0,
    pageSize: number = 51,
    sort: 'date-desc' | 'date-asc' | 'no-date' = 'date-desc',
    search?: string
): Promise<{ data: any[], count: number, error?: any }> {
    const adminDb = createAdminClient()

    // Base query
    let query = adminDb.from('news_items').select(`
        id, title, source_name, canonical_url, published_at,
        rss_summary, image_url,
        gate1_decision, gate1_score, gate1_tags, gate1_reason, gate1_processed_at,
        approve1_decision, approve1_decided_at, approve1_decided_by,
        sent_to_approve1_at, approve1_message_id, approve1_chat_id,
        status, is_viewed, created_at
    `, { count: 'exact' })

    // Apply filters
    if (filter === 'pending') {
        query = query.eq('gate1_decision', 'send').is('approve1_decision', null)
    } else if (filter === 'approved') {
        query = query.eq('approve1_decision', 'approved')
    } else if (filter === 'rejected') {
        query = query.eq('approve1_decision', 'rejected')
    }

    if (sources.length > 0) {
        query = query.in('source_name', sources)
    }

    if (search && search.trim()) {
        const s = search.trim().replace(/,/g, '\\,')
        // Search in title, source_name, reason (partial match) and tags (exact match within array)
        query = query.or(`title.ilike.*${s}*,source_name.ilike.*${s}*,gate1_reason.ilike.*${s}*,gate1_tags.cs.{${s}}`)
    }

    // Apply sorting
    if (sort === 'no-date') {
        query = query
            .order('published_at', { ascending: false, nullsFirst: true })
            .order('created_at', { ascending: false })
    } else {
        const isAscending = sort === 'date-asc'
        query = query
            .order('published_at', { ascending: isAscending, nullsFirst: false })
            .order('created_at', { ascending: isAscending })
    }

    // Pagination
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query.range(from, to)

    if (error) {
        console.error('[fetchContentItems] Error:', error)
        return { data: [], count: 0, error }
    }

    return { data: data || [], count: count || 0 }
}
