import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callAI } from '@/lib/ai-service'

type GenerateFieldRequest = {
    review_id?: string
    news_id?: string
    field: 'draft_title' | 'draft_announce' | 'draft_longread'
    extraContext?: string
}

export async function POST(req: Request) {
    const supabaseAdmin = createAdminClient()

    try {
        const { review_id, news_id, field, extraContext }: GenerateFieldRequest = await req.json()
        const contentId = review_id || news_id

        console.log(`[GenerateField] Received request for field: ${field}, contentId: ${contentId}`)

        if (!contentId || !field) {
            return NextResponse.json({ error: 'ID and field are required' }, { status: 400 })
        }

        let tableName = news_id ? 'news_items' : 'review_items'
        let item: any = null

        // Use Admin Client to bypass RLS and ensure we find the item
        const { data: data1, error: error1 } = await supabaseAdmin
            .from(tableName as any)
            .select('*')
            .eq('id', contentId)
            .single()

        if (!error1 && data1) {
            item = data1
        } else {
            console.log(`[GenerateField] Item not found in ${tableName}, trying fallback...`)
            const fallbackTable = tableName === 'news_items' ? 'review_items' : 'news_items'
            const { data: data2, error: error2 } = await supabaseAdmin
                .from(fallbackTable as any)
                .select('*')
                .eq('id', contentId)
                .single()

            if (!error2 && data2) {
                item = data2
                tableName = fallbackTable
            } else {
                console.error(`[GenerateField] Content item ${contentId} not found in either table.`)
                return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
            }
        }

        let promptKey = ''
        let userContent = ''

        if (field === 'draft_longread') {
            promptKey = 'rewrite_longread'

            let originalText = item.original_text || item.cleaned_text

            if (!originalText && item.canonical_url) {
                console.log(`[GenerateField] No original text for ${contentId}. Attempting on-the-fly scraping...`)
                try {
                    const { scrapeArticleText } = await import('@/lib/scraper-service')
                    let contentSelector: string | undefined = undefined

                    const { data: source } = await supabaseAdmin
                        .from('ingestion_sources')
                        .select('selectors')
                        .eq('name', item.source_name)
                        .single() as any

                    if (source?.selectors?.content_selector) {
                        contentSelector = source.selectors.content_selector
                    }

                    originalText = await scrapeArticleText(item.canonical_url, contentSelector)

                    if (originalText && originalText.length > 100) {
                        await supabaseAdmin
                            .from(tableName as any)
                            .update({ original_text: originalText })
                            .eq('id', contentId)
                        console.log(`[GenerateField] Successfully scraped and saved original_text for ${contentId}`)
                    }
                } catch (scrapeErr) {
                    console.error(`[GenerateField] Fallback scraping failed for ${contentId}:`, scrapeErr)
                }
            }

            userContent = originalText || item.rss_summary || item.title || ''
        } else if (field === 'draft_title') {
            promptKey = 'rewrite_title'
            userContent = item.draft_announce || item.draft_longread || item.original_text || item.rss_summary || item.title || ''
        } else if (field === 'draft_announce') {
            promptKey = 'rewrite_announce'
            userContent = item.draft_longread || item.original_text || item.rss_summary || ''
        }

        if (extraContext) userContent = extraContext;

        console.log(`[GenerateField] Using promptKey: ${promptKey}, userContent length: ${userContent?.length || 0}`)

        if (!userContent) {
            return NextResponse.json({ error: 'No source content available for generation' }, { status: 400 })
        }

        if (!promptKey) {
            return NextResponse.json({ error: `Unknown field: ${field}` }, { status: 400 })
        }

        const { data: promptData, error: promptError } = await supabaseAdmin
            .from('system_prompts')
            .select('content, provider, model, temperature')
            .eq('key', promptKey)
            .single()

        if (promptError || !promptData) {
            console.error(`[GenerateField] Prompt not found for key: ${promptKey}`, promptError)
            return NextResponse.json({ error: `Prompt not found: ${promptKey}` }, { status: 404 })
        }

        const config = {
            provider: promptData.provider,
            model: promptData.model,
            temperature: promptData.temperature,
            maxTokens: 15000
        }

        const generatedText = await callAI(
            promptData.content,
            `Original Context:\n${userContent}`,
            config
        )

        const { error: updateError } = await supabaseAdmin
            .from(tableName as any)
            .update({ [field]: generatedText.trim() })
            .eq('id', contentId)

        if (updateError) {
            console.error('[GenerateField] Final DB update error:', updateError)
        }

        return NextResponse.json({
            success: true,
            result: generatedText.trim()
        })

    } catch (error: any) {
        console.error('Error in generate-field:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
