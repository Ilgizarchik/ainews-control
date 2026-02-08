import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scrapeArticleText } from '@/lib/scraper-service'

export async function POST(req: Request) {
    const supabase = await createClient()

    try {
        const body = await req.json()
        console.log('[Scraper API] Received request:', body)
        const { url, news_id, review_id } = body

        let targetUrl = url

        // Если передан ID, но нет URL, берем из базы
        if (!targetUrl && (news_id || review_id)) {
            const table = news_id ? 'news_items' : 'review_items'
            const id = news_id || review_id
            console.log(`[Scraper API] Looking up URL in table ${table} for ID: ${id}`)

            const { data, error } = await supabase.from(table).select('canonical_url, url').eq('id', id).single()

            if (error) {
                console.error(`[Scraper API] DB lookup error:`, error)
            } else {
                targetUrl = data?.canonical_url || data?.url
                console.log(`[Scraper API] Found URL in DB: ${targetUrl}`)
            }
        }

        if (!targetUrl) {
            console.error('[Scraper API] No URL found for this request')
            return NextResponse.json({
                error: 'URL is required but was not found in request or database',
                debug: { news_id, review_id, hasUrlInRequest: !!url }
            }, { status: 400 })
        }

        console.log(`[Scraper API] Scraping URL: ${targetUrl}`)
        const text = await scrapeArticleText(targetUrl)

        return NextResponse.json({
            success: true,
            text,
            length: text.length
        })

    } catch (error: any) {
        console.error('[Scraper API] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
