'use server'

import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'
import { ProxyAgent } from 'undici'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

// Helper to interact with the chosen AI provider
async function callAiCompletion(systemPrompt: string, userContent: string) {
    const supabase = await createClient()

    // 1. Get Global AI Settings
    const { data: settings } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_key', 'ainews')
        .in('key', ['ai_provider', 'ai_model', 'ai_base_url', 'ai_key_openrouter', 'ai_key_openai', 'ai_key_anthropic', 'ai_key_custom', 'ai_proxy_url'])

    const config: Record<string, string> = {};
    (settings as any[])?.forEach(s => config[s.key] = s.value)

    const provider = config['ai_provider'] || 'openrouter'
    const model = config['ai_model'] || 'gpt-4o'
    const baseUrl = config['ai_base_url'] || 'https://openrouter.ai/api/v1'

    // Determine Key
    let apiKey = ''
    if (provider === 'openrouter') apiKey = config['ai_key_openrouter']
    else if (provider === 'openai') apiKey = config['ai_key_openai']
    else if (provider === 'anthropic') apiKey = config['ai_key_anthropic']
    else apiKey = config['ai_key_custom']

    if (!apiKey && provider !== 'custom') {
        throw new Error(`Missing API Key for provider ${provider}`)
    }

    // 2. Prepare Request
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    }

    if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://ainews.local'
        headers['X-Title'] = 'AiNews Control'
    }

    const payload = {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ],
        temperature: 0.2, // Low temp for deterministic code generation
        response_format: { type: "json_object" } // Force JSON if supported
    }

    // 3. Execute
    const cleanBaseUrl = baseUrl.replace(/\/$/, "")
    const url = `${cleanBaseUrl}/chat/completions`

    const fetchOptions: any = {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    }

    if (config['ai_proxy_url']) {
        console.log(`[AI Scan] Using Proxy: ${config['ai_proxy_url']}`)
        fetchOptions.dispatcher = new ProxyAgent(config['ai_proxy_url'])
    }

    console.log(`[AI Scan] Calling ${url} model=${model}`)
    const res = await fetch(url, fetchOptions)

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`AI Provider Error (${res.status}): ${err}`)
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from AI')

    return content
}

export async function scanUrlForSelectors(url: string) {
    try {
        console.log(`[Scan] Fetching ${url}...`)

        // 1. Fetch HTML with better headers
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        }).catch(err => {
            if (err.name === 'AbortError') throw new Error('Connection timed out (15s)')
            throw new Error(`Connection failed: ${err.message}`)
        })
        clearTimeout(timeoutId)

        if (!res.ok) throw new Error(`Site returned error: ${res.status} ${res.statusText}`)
        const html = await res.text()

        // 2. Pre-process HTML (Cheerio) to reduce tokens
        const $ = cheerio.load(html)

        // Remove scripts, styles, svgs, footers to save tokens
        $('script, style, svg, footer, nav, iframe, noscript').remove()

        // Try to identify the main content area or list
        // We'll take the <body> content but truncated
        let cleanHtml = $('body').html() || ''

        // Limit to ~20kb of text to avoid context limits, but keep structure
        if (cleanHtml.length > 50000) {
            cleanHtml = cleanHtml.substring(0, 50000) + '...'
        }

        // 3. Get System Prompt
        const supabase = await createClient()
        const { data: promptData } = await supabase
            .from('system_prompts')
            .select('content')
            .eq('key', 'ingestion_agent_parser')
            .single()

        const systemPrompt = (promptData as any)?.content || 'You are an expert. Return JSON selectors.'

        // 4. Call AI
        const aiResponse = await callAiCompletion(systemPrompt, `Analyze this HTML and find the news item list:\n\n${cleanHtml}`)

        // 5. Parse JSON
        // Cleanup markdown if present
        const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const selectors = JSON.parse(jsonStr)

        return { success: true, selectors }

    } catch (e: any) {
        console.error('Scan failed:', e)
        return { success: false, error: e.message }
    }
}

export async function testSelectors(url: string, selectors: any) {
    try {
        if (!selectors.container) throw new Error('Container selector missing')

        // Fetch
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        })
        const html = await res.text()
        const $ = cheerio.load(html)

        const items: any[] = []
        $(selectors.container).slice(0, 3).each((_, el) => {
            const $el = $(el)
            const extract = (sel: string, attr?: string) => {
                if (!sel || sel === 'null') return 'null'
                const $node = $el.find(sel)
                if ($node.length === 0) return 'not found'
                if (attr) return $node.attr(attr) || 'empty attr'
                return $node.text().trim() || 'empty text'
            }

            items.push({
                title: extract(selectors.title),
                link: extract(selectors.link, 'href'),
                summary: extract(selectors.summary),
                date: extract(selectors.date),
                image: extract(selectors.image, 'src')
            })
        })

        // NEW: Fetch first article content
        if (items.length > 0 && items[0].link && items[0].link !== 'not found') {
            try {
                let link = items[0].link
                if (!link.startsWith('http')) {
                    link = new URL(link, url).toString()
                }

                console.log(`[Test] Fetching article preview: ${link}`)
                const artRes = await fetch(link, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
                    }
                })
                if (artRes.ok) {
                    const artHtml = await artRes.text()

                    // Use Readability for smart extraction
                    try {
                        const dom = new JSDOM(artHtml, { url: link })
                        const reader = new Readability(dom.window.document)
                        const article = reader.parse()

                        if (article) {
                            const cleanText = (article.textContent || '')
                                .replace(/\s+/g, ' ') // Just flatten it for the preview snippet to avoid layout issues
                                .trim()

                            items[0].previewText = `${cleanText.substring(0, 1200)}...`
                        } else {
                            throw new Error('Readability failed')
                        }
                    } catch (e) {
                        // Fallback to raw text
                        const $art = cheerio.load(artHtml)
                        $art('script, style, nav, footer, header, aside, svg').remove()
                        const text = $art('body').text().replace(/\s+/g, ' ').trim()
                        items[0].previewText = `${text.substring(0, 1200)}...`
                    }
                } else {
                    items[0].previewText = `Error fetching article: ${artRes.status}`
                }
            } catch (e: any) {
                items[0].previewText = `Error fetching article: ${e.message}`
            }
        }

        return { success: true, items }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function saveSource(source: any) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('ingestion_sources')
        .insert(source)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function getDbSources() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('ingestion_sources')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return []
    return data
}


export async function deleteSource(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('ingestion_sources')
        .delete()
        .eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function toggleSourceActive(id: string, state: boolean) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('ingestion_sources')
        .update({ is_active: state })
        .eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}
