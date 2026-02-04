export interface ContentItem {
    id: string
    title: string
    source_name: string
    canonical_url: string
    published_at: string
    rss_summary: string | null
    image_url: string | null

    // Gate 1 (AI) результаты
    gate1_decision: 'send' | 'block' | null
    gate1_score: number | null
    gate1_tags: string[] | null
    gate1_reason: string | null
    gate1_processed_at: string | null

    // Approve 1 (человек)
    approve1_decision: 'approved' | 'rejected' | null
    approve1_decided_at: string | null
    approve1_decided_by: string | null
    sent_to_approve1_at: string | null
    approve1_message_id: number | null
    approve1_chat_id: number | null

    status: string
    is_viewed?: boolean
    created_at?: string
}

export type ContentFilter = 'all' | 'pending' | 'approved' | 'rejected'

export interface ContentStats {
    total: number
    pending: number
    approved: number
    rejected: number
}
