import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scrapeArticleText } from '@/lib/scraper-service'

export async function POST(req: Request) {
    const supabase = await createClient()

    try {
        const { url, news_id, review_id } = await req.json()

        let targetUrl = url

        // Если передан ID, но нет URL, берем из базы
        if (!targetUrl && (news_id || review_id)) {
            const table = news_id ? 'news_items' : 'review_items'
            const { data } = await supabase.from(table).select('canonical_url').eq('id', news_id || review_id).single()
            if (data?.canonical_url) targetUrl = data.canonical_url
        }

        if (!targetUrl) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
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
