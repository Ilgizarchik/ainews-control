import * as cheerio from 'cheerio'
import Parser from 'rss-parser'
import iconv from 'iconv-lite'
import { LEGACY_SOURCES, IngestionSource } from './sources'
import { createClient } from '@/lib/supabase/server'
import { createClient as createParamsClient, SupabaseClient } from '@supabase/supabase-js' // Fallback for pure utils if execution context differs, but here we use server action context


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

// Helper to fetch valid HTML (handling CP1251 if needed, though most are UTF8 now)
// We use simple fetch, but if we need CP1251 we might need arrayBuffer
async function fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
            const baseUrl = new URL(source.url).origin
            fullLink = new URL(link, baseUrl).toString()
        }

        items.push({
            title: extract(s.title),
            link: fullLink,
            summary: extract(s.summary),
            publishedAt: null, // Agent usually doesn't return reliable date parsers yet
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

    // Some RSS feeds have issues with encoding or weird headers, better fetch text manually
    const text = await fetchHtml(source.url)
    const feed = await parser.parseString(text)

    return feed.items.map(item => {
        let imageUrl = item.enclosure?.url || item.image?.url || null
        // fallback: try to find img in content
        if (!imageUrl && item.content) {
            const $ = cheerio.load(item.content)
            imageUrl = $('img').attr('src') || null
        }

        return {
            title: item.title || null,
            link: item.link || '',
            summary: (item.contentSnippet || item.content || '').substring(0, 500),
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            imageUrl,
            sourceName: new URL(source.url).hostname.replace('www.', ''),
            externalId: item.guid || item.link
        }
    })
}

async function parseHuntingRu(source: IngestionSource): Promise<ParsedItem[]> {
    const html = await fetchHtml(source.url)
    const $ = cheerio.load(html)
    const items: ParsedItem[] = []

    $('.content__central .record.btn-hidden-wrap').each((_, el) => {
        const $el = $(el)
        const $link = $el.find('a.record__title')
        const link = $link.attr('href')
        if (!link) return

        const fullLink = link.startsWith('http') ? link : `https://www.hunting.ru${link}`

        // Date parsing is tricky for RU text ("20 мая 2024"), skipping complex logic for MVP, using Now or attempting standard
        // In n8n we had specific parser. Let's try to extract standard attributes if possible.
        // For MVP, we will set publishedAt to null or current time if not parsable.

        items.push({
            title: $link.text().trim(),
            link: fullLink,
            summary: $el.find('.record__text').text().trim(),
            publishedAt: new Date().toISOString(), // TODO: Implement Ru Date Parser
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

    // Selector based on n8n template: a[href^="/official/world-news/"]
    // It seems they list links.
    $('a[href^="/official/world-news/"]').each((_, el) => {
        const $link = $(el)
        const href = $link.attr('href')
        if (!href || href.includes('?page=') || href === 'archive/') return

        // Mooir lists are just links often, need to go inside? 
        // n8n template logic was: get list of links and titles.

        items.push({
            title: $link.text().trim(),
            link: `https://mooir.ru${href}`,
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

    $('a[href^="/official/prikras/"]').each((_, el) => {
        const $link = $(el)
        const href = $link.attr('href')
        if (!href) return

        items.push({
            title: $link.text().trim(),
            link: `https://mooir.ru${href}`,
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

    // ul.listing__body article.read-material
    $('ul.listing__body article.read-material').each((_, el) => {
        const $el = $(el)
        const $link = $el.find('a.cursor').not('.read-material__img')
        const href = $link.attr('href')
        if (!href) return

        let img = $el.find('a.read-material__img img').attr('data-src') || $el.find('a.read-material__img img').attr('src')

        // Ensure absolute link
        const fullLink = href.startsWith('http') ? href : `https://www.ohotniki.ru${href.startsWith('/') ? '' : '/'}${href}`

        items.push({
            title: $el.find('h3.read-material__title').text().trim(),
            link: fullLink,
            summary: $el.find('p.read-material__text').text().trim(),
            publishedAt: null, // Need complex parsing
            imageUrl: img || null,
            sourceName: 'ohotniki.ru'
        })
    })

    return items
}


// ------------------------------------------------------------------
// Main Ingestion Logic
// ------------------------------------------------------------------

import { Database } from '@/types/database.types'

export async function runIngestion(sourceIds?: string[], client?: SupabaseClient<Database>) {
    const supabase = (client || await createClient()) as SupabaseClient<Database>

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

    // Merge with legacy (override legacy if same ID exists? legacy ids are simple strings, db are uuids, so no overlap usually)
    const allSources = [...LEGACY_SOURCES, ...dbSourcesMapped]

    // Determine which sources to run
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
            console.log(`[Ingestion] Starting ${source.name} (${source.parser})...`)
            let items: ParsedItem[] = []

            switch (source.parser) {
                case 'generic-rss': items = await parseRss(source); break;
                case 'html-universal': items = await parseUniversalHtml(source); break;

                // Legacy Hardcoded
                case 'hunting-ru-news': items = await parseHuntingRu(source); break;
                case 'mooir-ru-news': items = await parseMooirRu(source); break;
                case 'mooir-ru-prikras': items = await parseMooirPrikras(source); break;
                case 'ohotniki-ru-search': items = await parseOhotnikiSearch(source); break;
                default: console.warn(`Unknown parser ${source.parser}`);
            }

            // Dedupe and Insert
            for (const item of items) {
                if (!item.link) continue

                // Check existence
                const { data: existing } = await supabase
                    .from('news_items')
                    .select('id')
                    .eq('canonical_url', item.link)
                    .single()

                if (!existing) {
                    await supabase.from('news_items').insert({
                        title: item.title || item.summary?.substring(0, 50) || item.link.substring(0, 50),
                        canonical_url: item.link,
                        source_name: item.sourceName,
                        rss_summary: item.summary,
                        published_at: item.publishedAt, // can be null
                        image_url: item.imageUrl,
                        status: 'found'
                    } as any)
                    results.newInserted++
                }
            }

            // ОБНОВЛЯЕМ время последнего запуска для источника
            if (source.id && source.is_custom) {
                await supabase
                    .from('ingestion_sources')
                    .update({ last_run_at: new Date().toISOString() })
                    .eq('id', source.id)
            }

            console.log(`[Ingestion] ${source.name}: Processed ${items.length} items.`)
            results.totalFound += items.length

        } catch (e: any) {
            console.error(`[Ingestion] Error processing ${source.name}:`, e)
            results.errors.push(`${source.name}: ${e.message}`)
        }
    }

    return results
}
