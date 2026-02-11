import { createClient } from "@/lib/supabase/client"

export type IngestionSource = {
    id: string
    name: string
    type: 'rss' | 'html'
    url: string
    parser: 'generic-rss' | 'html-universal' | 'hunting-ru-news' | 'mooir-ru-news' | 'mooir-ru-prikras' | 'ohotniki-ru-search'
    selectors?: any // JSON для универсального парсера
    isActive: boolean
    icon?: string
    is_custom?: boolean
}

// Захардкоженные legacy-источники (фолбэк)
export const LEGACY_SOURCES: IngestionSource[] = []

export const getIngestionSources = async (): Promise<IngestionSource[]> => {
    // 1. Получаем источники из БД
    // Эта функция должна быть изоморфной (совместимой с client/server в зависимости от импортов)
    // Пока предполагаем, что вызываем ее из Server Actions или Client Components со стандартными клиентами.
    // Сейчас просто возвращаем LEGACY, а интеграция будет в service.ts
    // По факту это вспомогательная функция для типов.
    return LEGACY_SOURCES
}
