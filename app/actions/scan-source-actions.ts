'use server'

import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execPromise = promisify(exec)

// Helper to interact with the chosen AI provider
async function callAiCompletion(systemPrompt: string, userContent: string) {
    const supabase = await createClient()

    // 1. Get Global AI Settings
    const { data: settings } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_key', 'ainews')
        .in('key', [
            'ai_provider',
            'ai_model',
            'ai_base_url',
            'ai_key_openrouter',
            'ai_key_openai',
            'ai_key_anthropic',
            'ai_key_custom',
            'ai_proxy_url',
            'ai_proxy_enabled'
        ])

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

    if (config['ai_proxy_enabled'] === 'true' && config['ai_proxy_url']) {
        fetchOptions.dispatcher = new ProxyAgent(config['ai_proxy_url'])
    }
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

async function fetchHtmlWithPythonBridge(url: string): Promise<string> {
    const supabase = await createClient()
    const { data: proxyData } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_key', 'ainews')
        .in('key', ['ai_proxy_url', 'ai_proxy_enabled'])

    const proxyConfig = {
        url: (proxyData as any[])?.find(r => r.key === 'ai_proxy_url')?.value,
        enabled: (proxyData as any[])?.find(r => r.key === 'ai_proxy_enabled')?.value === 'true'
    }

    try {
        console.log(`[Scan] Attempting Python Bridge for: ${url}`)
        const bridgePath = path.join(process.cwd(), 'scraper_bridge.py')
        let cmd = `python "${bridgePath}" --url "${url}" --html`
        if (proxyConfig?.enabled && proxyConfig?.url) {
            cmd += ` --proxy "${proxyConfig.url}"`
        }

        const { stdout } = await execPromise(cmd, { timeout: 45000 })
        const jsonMatch = stdout.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error(`Could not find JSON in Python output`)

        const result = JSON.parse(jsonMatch[0])
        if (result.success && result.content) {
            console.log(`[Scan] Python Bridge Success! Size: ${result.content.length}`)
            return result.content
        }
        throw new Error(result.error || 'Python bridge failed to return content')
    } catch (e: any) {
        console.warn(`[Scan] Python Bridge failed, falling back to Node.js:`, e.message)

        // Fallback to native Node.js fetch
        const dispatcher = proxyConfig.enabled && proxyConfig.url ? new ProxyAgent(proxyConfig.url) : undefined
        const res = await undiciFetch(url, {
            dispatcher: dispatcher as any,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/'
            }
        })
        if (!res.ok) throw new Error(`Site returned error: ${res.status}`)
        return await res.text()
    }
}

export async function scanUrlForSelectors(url: string) {
    try {
        // 1. Fetch HTML using Bridge or Node.js Fallback
        const html = await fetchHtmlWithPythonBridge(url)

        // 2. Pre-process HTML (Cheerio) to reduce tokens
        const $ = cheerio.load(html)

        // Remove scripts, styles, svgs, footers to save tokens
        $('script, style, svg, footer, nav, iframe, noscript').remove()

        // Try to identify the main content area or list
        let cleanHtml = $('body').html() || ''

        // Limit to ~50kb of text to avoid context limits
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
        const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const selectors = JSON.parse(jsonStr)

        // *** PHASE 2: AUTO-DETECT DATE IN ARTICLE ***
        const hasDate = selectors.date && selectors.date !== 'null'

        if (!hasDate && selectors.link && selectors.container) {
            try {
                // Find first link
                const $item = $(selectors.container).first()
                const link = $item.find(selectors.link).attr('href')

                if (link) {
                    let fullLink = link
                    if (!link.startsWith('http')) {
                        fullLink = new URL(link, url).toString()
                    }

                    const artHtml = await fetchHtmlWithPythonBridge(fullLink)
                    if (artHtml) {
                        // Ask AI to specificially find date in this article
                        const datePrompt = `Here is an article page HTML. Find the CSS selector for the publication date/time. Return JSON: { "date_detail": "css_selector" }. If not found, return null.`
                        const dateAiRes = await callAiCompletion(systemPrompt, `${datePrompt}\n\n${artHtml.substring(0, 40000)}`)
                        const dateJson = JSON.parse(dateAiRes.replace(/```json/g, '').replace(/```/g, '').trim())

                        if (dateJson.date_detail) {
                            selectors.date_detail = dateJson.date_detail
                        }
                    }
                }
            } catch (e) {
                console.warn('[Scan] Failed to auto-detect article date:', e)
            }
        }

        return { success: true, selectors }

    } catch (e: any) {
        console.error('Scan failed:', e)
        return { success: false, error: e.message }
    }
}

export async function testSelectors(url: string, selectors: any) {
    try {
        if (!selectors.container) throw new Error('Container selector missing')

        // Fetch using Bridge or Node.js Fallback
        const html = await fetchHtmlWithPythonBridge(url)
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

        // Fetch first article content
        if (items.length > 0 && items[0].link && items[0].link !== 'not found') {
            try {
                let link = items[0].link
                if (!link.startsWith('http')) {
                    link = new URL(link, url).toString()
                }

                const artHtml = await fetchHtmlWithPythonBridge(link)
                if (artHtml) {
                    // Try to extract detail date if selector present
                    if (selectors.date_detail) {
                        try {
                            const $art = cheerio.load(artHtml)
                            const detailDate = $art(selectors.date_detail).text().trim()
                            if (detailDate) {
                                items[0].dateFromDetail = detailDate
                                if (!items[0].date || items[0].date === 'empty text' || items[0].date === 'not found' || items[0].date === 'null') {
                                    items[0].date = detailDate + ' (from article)'
                                }
                            }
                        } catch (e) {
                            console.error('Detail date extraction failed:', e)
                        }
                    }

                    // Use Readability
                    try {
                        const dom = new JSDOM(artHtml, { url: link })
                        const reader = new Readability(dom.window.document)
                        const article = reader.parse()

                        if (article) {
                            const cleanText = (article.textContent || '').replace(/\s+/g, ' ').trim()
                            items[0].previewText = `${cleanText.substring(0, 1200)}...`
                        } else {
                            throw new Error('Readability failed')
                        }
                    } catch {
                        const $art = cheerio.load(artHtml)
                        $art('script, style, nav, footer, header, aside, svg').remove()
                        const text = $art('body').text().replace(/\s+/g, ' ').trim()
                        items[0].previewText = `${text.substring(0, 1200)}...`
                    }
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
        .upsert(source, { onConflict: 'id' } as any)

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
