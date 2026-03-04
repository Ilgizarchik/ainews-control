import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeArticleText } from '@/lib/scraper-service'

export async function POST(req: Request) {
    const supabase = createAdminClient()

    try {
        const body = await req.json()
        console.log('[Scraper API] Received request:', body)
        const { url, news_id, review_id } = body

        let targetUrl = url

        // Если передан ID, но нет URL, берем из базы
        if (!targetUrl && (news_id || review_id)) {
            if (news_id) {
                console.log(`[Scraper API] Looking up URL in table news_items for ID: ${news_id}`)
                const { data, error } = await supabase
                    .from('news_items')
                    .select('canonical_url')
                    .eq('id', news_id)
                    .single()

                if (error) {
                    console.error(`[Scraper API] DB lookup error for news_items/${news_id}:`, error)
                } else {
                    targetUrl = (data as any)?.canonical_url
                    console.log(`[Scraper API] Found URL in DB: ${targetUrl}`)
                }
            } else if (review_id) {
                console.log(`[Scraper API] Looking up URL in table review_items for ID: ${review_id}`)
                const { data, error } = await supabase
                    .from('review_items')
                    .select('published_url')
                    .eq('id', review_id)
                    .single()

                if (error) {
                    console.error(`[Scraper API] DB lookup error for review_items/${review_id}:`, error)
                } else {
                    targetUrl = (data as any)?.published_url
                    console.log(`[Scraper API] Found URL in DB: ${targetUrl}`)
                }
            }
        }

        if (!targetUrl) {
            console.error('[Scraper API] No URL found. Request body:', JSON.stringify(body))
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
