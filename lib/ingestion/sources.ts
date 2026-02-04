import { createClient } from "@/lib/supabase/client"

export type IngestionSource = {
    id: string
    name: string
    type: 'rss' | 'html'
    url: string
    parser: 'generic-rss' | 'html-universal' | 'hunting-ru-news' | 'mooir-ru-news' | 'mooir-ru-prikras' | 'ohotniki-ru-search'
    selectors?: any // JSON for universal parser
    isActive: boolean
    icon?: string
    is_custom?: boolean
}

// Hardcoded legacy sources (fallback)
export const LEGACY_SOURCES: IngestionSource[] = []

export const getIngestionSources = async (): Promise<IngestionSource[]> => {
    // 1. Fetch DB sources
    // This function must be isomorphic (client/server compatible depending on imports)
    // For now, let's assume we call it from Server Actions or Client Components with standard clients.
    // We will just return LEGACY for now, but integration will happen in service.ts
    // Actually, let's make this just a helper for types.
    return LEGACY_SOURCES
}
