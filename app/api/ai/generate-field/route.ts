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
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    try {
        const { review_id, news_id, field, extraContext }: GenerateFieldRequest = await req.json()
        const contentId = review_id || news_id

        if (!contentId || !field) {
            return NextResponse.json({ error: 'ID and field are required' }, { status: 400 })
        }

        // Default table based on ID presence, but can be switched
        let tableName = news_id ? 'news_items' : 'review_items'

        // 1. Get content item - Try primary table first
        let item: any = null

        const { data: data1, error: error1 } = await supabase
            .from(tableName as any)
            .select('*')
            .eq('id', contentId)
            .single()

        if (!error1 && data1) {
            item = data1
        } else {
            // Try fallback table
            const fallbackTable = tableName === 'news_items' ? 'review_items' : 'news_items'
            const { data: data2, error: error2 } = await supabase
                .from(fallbackTable as any)
                .select('*')
                .eq('id', contentId)
                .single()

            if (!error2 && data2) {
                item = data2
                tableName = fallbackTable // Update table name for later usage
            } else {
                // If both failed, return valid error
                return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
            }
        }

        // 2. Determine Prompt Key and Context
        let promptKey = ''
        let userContent = ''

        const cleanText = item.cleaned_text || item.summary || item.title || ''
        const longread = item.draft_longread || ''
        const announce = item.draft_announce || ''

        switch (field) {
            case 'draft_title':
                promptKey = 'rewrite_title'
                // Context: Announce or Longread or Cleaned Text
                userContent = announce || longread || cleanText
                break
            case 'draft_announce':
                promptKey = 'rewrite_announce'
                // Context: Longread or Cleaned Text
                userContent = longread || cleanText
                break
            case 'draft_longread':
                promptKey = 'rewrite_longread'
                // Context: Cleaned Text (source)
                userContent = cleanText
                break
        }

        if (!userContent && !extraContext) {
            return NextResponse.json({ error: 'No source content available for generation' }, { status: 400 })
        }

        if (extraContext) userContent = extraContext;

        // 3. Fetch Prompt
        const { data: promptData, error: promptError } = await supabaseAdmin
            .from('system_prompts')
            .select('content, provider, model, temperature')
            .eq('key', promptKey)
            .single()

        if (promptError || !promptData) {
            // If prompt is missing for title, use default logic
            if (field === 'draft_title') {
                // Fallback or create prompt?
                // For now, return error to encourage prompt creation
                return NextResponse.json({ error: `Prompt not found: ${promptKey}` }, { status: 404 })
            }
            return NextResponse.json({ error: `Prompt not found: ${promptKey}` }, { status: 404 })
        }

        // 4. Call AI
        const config = {
            provider: promptData.provider,
            model: promptData.model,
            temperature: promptData.temperature,
            maxTokens: 4000 // Increased to support reasoning models
        }

        const generatedText = await callAI(
            promptData.content,
            `Original Context:\n${userContent}`,
            config
        )

        // 5. Update DB (Optional, but good for saving progress)
        await supabase
            .from(tableName as any)
            .update({ [field]: generatedText.trim() })
            .eq('id', contentId)

        return NextResponse.json({
            success: true,
            result: generatedText.trim()
        })

    } catch (error: any) {
        console.error('Error in generate-field:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
