import * as cheerio from 'cheerio'
import Parser from 'rss-parser'
import { fetch as undiciFetch } from 'undici'
import { LEGACY_SOURCES, IngestionSource } from './sources'
import { createClient } from '@/lib/supabase/server'
import { createClient as createParamsClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { processGate1 } from '../generation-service'

// Types for parsed items
export type ParsedItem = {
    title: string | null
    link: string
    summary: string | null
    publishedAt: string | null // ISO String
    imageUrl: string | null
    sourceName: string
    externalId?: string
}

// Helper for proxy
async function getProxyDispatcher() {
    try {
        const supabase = await createClient()
        const { data } = await supabase
            .from('project_settings')
            .select('value')
            .eq('project_key', 'ainews')
            .eq('key', 'ai_proxy_url')
            .single()

        if (data?.value) {
            const { ProxyAgent } = await import('undici')
            return new ProxyAgent(data.value)
        }
    } catch { }
    return undefined
}

// Helper to fetch valid HTML
async function fetchHtml(url: string): Promise<string> {
    const dispatcher = await getProxyDispatcher()

    // Modern headers to mimic the scanner's successful logic
    const res = await undiciFetch(url, {
        dispatcher: dispatcher as any,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
    return res.text() // Assume UTF-8 for now
}

// ------------------------------------------------------------------
// Parsers
// ------------------------------------------------------------------

async function parseUniversalHtml(source: IngestionSource): Promise<ParsedItem[]> {
    if (!source.selectors || !source.selectors.container) {
        throw new Error('Missing selectors config for universal parser')
    }

    const html = await fetchHtml(source.url)
    const $ = cheerio.load(html)
    const items: ParsedItem[] = []
    const s = source.selectors

    $(s.container).each((_, el) => {
        const $el = $(el)

        // Helper to extract text or attr
        const extract = (selector: string | undefined, attr?: string) => {
            if (!selector || selector === 'null') return null
            const $node = $el.find(selector)
            if (attr) return $node.attr(attr) || null
            return $node.text().trim() || null
        }

        const link = extract(s.link, 'href')
        if (!link) return

        let fullLink = link
        if (!link.startsWith('http')) {
            fullLink = new URL(link, source.url).toString()
        }

        items.push({
            title: extract(s.title),
            link: fullLink,
            summary: extract(s.summary),
            publishedAt: extract(s.date),
            imageUrl: extract(s.image, 'src'),
            sourceName: source.name || new URL(source.url).hostname,
            externalId: fullLink
        })
    })

    return items
}

async function parseRss(source: IngestionSource): Promise<ParsedItem[]> {
    const parser = new Parser({
        customFields: {
            item: ['description', 'content:encoded', 'pubDate', 'enclosure', 'image'],
        }
    })

    const text = await fetchHtml(source.url)
    const feed = await parser.parseString(text)

    return feed.items.map(item => {
        let imageUrl = item.enclosure?.url || item.image?.url || null
        if (!imageUrl && item.content) {
            const $ = cheerio.load(item.content)
            imageUrl = $('img').attr('src') || null
        }

        const link = item.link || ''
        let fullLink = link
        if (link && !link.startsWith('http')) {
            try {
                const origin = new URL(source.url).origin
                fullLink = new URL(link, origin).toString()
            } catch (e) {
                console.warn(`[Ingestion] Failed to resolve link: ${link}`, e)
            }
        }

        return {
            title: item.title || null,
            link: fullLink,
            summary: (item.contentSnippet || item.content || '').substring(0, 500),
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            imageUrl,
            sourceName: new URL(source.url).hostname.replace('www.', ''),
            externalId: item.guid || fullLink
        }
    })
}

async function parseHuntingRu(source: IngestionSource): Promise<ParsedItem[]> {
    const html = await fetchHtml(source.url)
    const $ = cheerio.load(html)
    const items: ParsedItem[] = []
    const baseUrl = new URL(source.url).origin

    $('.content__central .record.btn-hidden-wrap').each((_, el) => {
        const $el = $(el)
        const $link = $el.find('a.record__title')
        const link = $link.attr('href')
        if (!link) return
        const fullLink = link.startsWith('http') ? link : new URL(link, baseUrl).toString()

        items.push({
            title: $link.text().trim(),
            link: fullLink,
            summary: $el.find('.record__text').text().trim(),
            publishedAt: new Date().toISOString(),
            imageUrl: $el.find('.record__img-wrapper img').attr('src') || null,
            sourceName: 'hunting.ru'
        })
    })
    return items
}

async function parseMooirRu(source: IngestionSource): Promise<ParsedItem[]> {
    const html = await fetchHtml(source.url)
    const $ = cheerio.load(html)
    const items: ParsedItem[] = []

    // Mooir articles usually have a numeric ID at the end: /official/world-news/1521/
    // We filter specifically for this pattern to avoid picking up category or pagination links.
    $('a[href*="/official/world-news/"]').each((_, el) => {
        const $link = $(el)
        const href = $link.attr('href')
        if (!href) return

        // Regex for numeric ID at the end (with or without trailing slash)
        const isArticle = /\/official\/world-news\/\d+\/?$/.test(href.split('?')[0])
        if (!isArticle || href.includes('?page=') || href.includes('archive/')) return

        const title = $link.text().trim()
        if (!title || title.length < 5) return // Skip small links/buttons

        items.push({
            title,
            link: href.startsWith('http') ? href : new URL(href, source.url).toString(),
            summary: null,
            publishedAt: null,
            imageUrl: null,
            sourceName: 'mooir.ru'
        })
    })
    return items
}

async function parseMooirPrikras(source: IngestionSource): Promise<ParsedItem[]> {
    const html = await fetchHtml(source.url)
    const $ = cheerio.load(html)
    const items: ParsedItem[] = []

    $('a[href*="/official/prikras/"]').each((_, el) => {
        const $link = $(el)
        const href = $link.attr('href')
        if (!href) return

        // Ensure it has a numeric ID at the end
        const isArticle = /\/official\/prikras\/\d+\/?$/.test(href.split('?')[0])
        if (!isArticle) return

        const title = $link.text().trim()
        if (!title || title.length < 5) return

        items.push({
            title,
            link: href.startsWith('http') ? href : new URL(href, source.url).toString(),
            summary: null,
            publishedAt: null,
            imageUrl: null,
            sourceName: 'mooir.ru'
        })
    })
    return items
}

async function parseOhotnikiSearch(source: IngestionSource): Promise<ParsedItem[]> {
    const html = await fetchHtml(source.url)
    const $ = cheerio.load(html)
    const items: ParsedItem[] = []
    const baseUrl = new URL(source.url).origin

    $('ul.listing__body article.read-material').each((_, el) => {
        const $el = $(el)
        const $link = $el.find('a.cursor').not('.read-material__img')
        const href = $link.attr('href')
        if (!href) return

        let img = $el.find('a.read-material__img img').attr('data-src') || $el.find('a.read-material__img img').attr('src')
        const fullLink = href.startsWith('http') ? href : new URL(href, baseUrl).toString()

        items.push({
            title: $el.find('h3.read-material__title').text().trim(),
            link: fullLink,
            summary: $el.find('p.read-material__text').text().trim(),
            publishedAt: null,
            imageUrl: img || null,
            sourceName: 'ohotniki.ru'
        })
    })
    return items
}

// ------------------------------------------------------------------
// Main Ingestion Logic
// ------------------------------------------------------------------

export async function runIngestion(sourceIds?: string[], client?: SupabaseClient<Database>) {
    // Standard client for broadcasting (server-side realtime)
    const supabase = (client || createParamsClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                persistSession: false
            }
        }
    )) as SupabaseClient<Database>

    // Broadcast Setup for UI Feedback
    const broadcastChannel = supabase.channel('ingestion-updates')
    broadcastChannel.subscribe(() => { })

    const sendStatus = async (msg: string, type: 'info' | 'thinking' | 'success' | 'error' = 'info') => {
        await broadcastChannel.send({
            type: 'broadcast',
            event: 'scan-status',
            payload: { message: msg, type }
        })
    }

    // Fetch DB Sources
    const { data: dbSources } = await supabase
        .from('ingestion_sources')
        .select('*')
        .eq('is_active', true)

    const dbSourcesMapped: IngestionSource[] = ((dbSources as any[]) || []).map(r => {
        let parser = r.type === 'rss' ? 'generic-rss' : 'html-universal'
        if (r.selectors && r.selectors.legacy_parser) {
            parser = r.selectors.legacy_parser
        }

        return {
            id: r.id,
            name: r.name,
            url: r.url,
            type: r.type as any,
            parser: parser as any,
            selectors: r.selectors,
            isActive: r.is_active,
            icon: r.type === 'rss' ? 'rss' : 'globe',
            is_custom: true
        }
    })

    const allSources = [...LEGACY_SOURCES, ...dbSourcesMapped]

    const targets = sourceIds
        ? allSources.filter(s => sourceIds.includes(s.id))
        : allSources.filter(s => s.isActive)

    const results = {
        totalFound: 0,
        newInserted: 0,
        errors: [] as string[]
    }

    for (const source of targets) {
        try {
            await sendStatus(`🔍 Сканирую: ${source.name}...`, 'thinking')
            let items: ParsedItem[] = []

            switch (source.parser) {
                case 'generic-rss': items = await parseRss(source); break;
                case 'html-universal': items = await parseUniversalHtml(source); break;
                case 'hunting-ru-news': items = await parseHuntingRu(source); break;
                case 'mooir-ru-news': items = await parseMooirRu(source); break;
                case 'mooir-ru-prikras': items = await parseMooirPrikras(source); break;
                case 'ohotniki-ru-search': items = await parseOhotnikiSearch(source); break;
                default: console.warn(`Unknown parser ${source.parser}`);
            }

            // Dedupe and Insert
            for (const item of items) {
                if (!item.link) continue

                const { data: existing } = await supabase
                    .from('news_items')
                    .select('id')
                    .eq('canonical_url', item.link)
                    .single()

                if (!existing) {
                    // FALLBACK DATE LOGIC
                    if (!item.publishedAt || item.publishedAt === 'null') {
                        const selDetail = (source.selectors as any)?.date_detail
                        const selMain = (source.selectors as any)?.date

                        // We only fetch if we have at least one selector to try
                        if (selDetail || selMain) {
                            try {
                                // Use modern fetch with proxy handled in fetchHtml
                                const artHtml = await fetchHtml(item.link)
                                const $art = cheerio.load(artHtml)

                                let detailDate: string | null = null

                                // 1. Try explicit detail selector
                                if (selDetail) {
                                    if (selDetail.includes('meta')) {
                                        detailDate = $art(selDetail).attr('content') || $art(selDetail).attr('value') || null
                                    } else {
                                        detailDate = $art(selDetail).text().trim() || null
                                    }
                                }

                                // 2. Fallback to main selector
                                if (!detailDate && selMain) {
                                    if (selMain.includes('meta')) {
                                        detailDate = $art(selMain).attr('content') || $art(selMain).attr('value') || null
                                    } else {
                                        detailDate = $art(selMain).text().trim() || null
                                    }
                                }

                                if (detailDate && detailDate !== 'null') {
                                    item.publishedAt = detailDate
                                }
                            } catch (e) {
                                console.warn(`[Ingestion] Failed to fetch article date:`, e)
                            }
                        }
                    }

                    const { data: inserted } = await supabase.from('news_items').insert({
                        title: item.title || item.summary?.substring(0, 50) || item.link.substring(0, 50),
                        canonical_url: item.link,
                        source_name: item.sourceName,
                        rss_summary: item.summary,
                        published_at: item.publishedAt,
                        image_url: item.imageUrl,
                        status: 'found'
                    } as any).select('id').single()

                    if (inserted) {
                        try {
                            await processGate1((inserted as any).id)
                        } catch (g1Err) {
                            console.error('Gate 1 trigger failed', g1Err)
                        }
                    }

                    results.newInserted++
                } else {
                    // TEMP: Force re-trigger AI for existing items (User Request)
                    try {
                        await processGate1(existing.id)
                    } catch (g1Err) {
                        console.error('Gate 1 trigger failed for existing item', g1Err)
                    }
                }
            }

            if (source.id && source.is_custom) {
                await supabase
                    .from('ingestion_sources')
                    .update({ last_run_at: new Date().toISOString() })
                    .eq('id', source.id)
            }

            results.totalFound += items.length
            await sendStatus(`${source.name}: Найдено ${items.length} (Новых: ${items.length // Approximation, true count is inside loop
                })`, 'success')

        } catch (e: any) {
            console.error(`[Ingestion] Error processing ${source.name}:`, e)
            results.errors.push(`${source.name}: ${e.message}`)
        }
    }

    return results
}
