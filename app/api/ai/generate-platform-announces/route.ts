import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callAI } from '@/lib/ai-service'

type GeneratePlatformAnnouncesRequest = {
    review_id?: string
    news_id?: string
    platforms: string[] // ['tg', 'vk', 'ok', etc.]
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    try {
        const { review_id, news_id, platforms }: GeneratePlatformAnnouncesRequest = await req.json()
        const contentId = review_id || news_id
        let tableName = news_id ? 'news_items' : 'review_items'

        if (!contentId || !platforms || platforms.length === 0) {
            return NextResponse.json({ error: 'ID and platforms are required' }, { status: 400 })
        }

        // 1. Get content item (User Context)
        // 1. Get content item (User Context) - Robust check
        let item: any = null
        let { data, error: fetchError } = await (supabase
            .from(tableName)
            .select('draft_announce, draft_title, draft_longread, draft_longread_site')
            .eq('id', contentId)
            .single() as any)

        if (!fetchError && data) {
            item = data
        } else {
            // Try fallback table
            const fallbackTable = tableName === 'news_items' ? 'review_items' : 'news_items'
            const { data: fallbackData, error: fallbackError } = await (supabase
                .from(fallbackTable)
                .select('draft_announce, draft_title, draft_longread, draft_longread_site')
                .eq('id', contentId)
                .single() as any)

            if (fallbackData && !fallbackError) {
                item = fallbackData
                tableName = fallbackTable // CRITICAL: Update table name for subsequent updates
                console.log(`[GenerateAnnounce] Relocated item ${contentId} in ${tableName}`)
            }
        }

        if (!item) {
            return NextResponse.json({ error: 'Content item not found in any table' }, { status: 404 })
        }

        const baseAnnounce = item.draft_announce || ''
        const title = item.draft_title || ''
        // Source selection logic (REVERTED):
        // - SITE: Always generate from the full longread article (`draft_longread`)
        // - SOCIALS: Always generate from the short announce (`draft_announce`) as requested
        const getSourceForPlatform = (platform: string) => {
            if (platform === 'site') {
                return item.draft_longread || item.draft_announce
            }
            // For TG, VK, OK, etc. - use the short announce
            return item.draft_announce || item.draft_longread
        }

        if (!baseAnnounce && !item.draft_longread) {
            return NextResponse.json({ error: 'No content to process' }, { status: 400 })
        }

        // 2. Get ALL prompts to be safe (small table)
        const { data: promptsData, error: promptsError } = await (supabaseAdmin
            .from('system_prompts')
            .select('key, content, provider, model, temperature') as any)

        if (promptsError) {
            console.error("Prompts fetch error:", promptsError)
            throw promptsError
        }


        // Map configs
        const promptMap = (promptsData as any[]).reduce((acc, p) => ({
            ...acc,
            [p.key.trim()]: p
        }), {} as Record<string, { content: string, provider?: string, model?: string, temperature?: number }>)

        // 3. Generate announces for each platform
        const results: Record<string, string> = {}

        for (const platform of platforms) {
            const promptKey = `rewrite_social_${platform.toLowerCase()}`
            const promptData = promptMap[promptKey]

            if (!promptData) {
                console.warn(`Prompt not found for platform: ${platform} (key: ${promptKey})`)
                // Fallback: try looking for key without prefix if needed, or just log available keys
                console.warn('Available keys:', Object.keys(promptMap))
                continue
            }

            try {
                // Determine source content: prefer longread for better context
                const sourceContent = getSourceForPlatform(platform)

                if (!sourceContent) {
                    results[platform] = `[Нет исходного контента для ${platform}]`
                    continue
                }

                // Stage 1: Generate text
                const config = {
                    provider: promptData.provider,
                    model: promptData.model,
                    temperature: promptData.temperature,
                    maxTokens: platform === 'site' ? 12000 : 6000 // High limits for reasoning models
                }

                let generatedText = await callAI(
                    promptData.content,
                    `Название: ${title}\n\nИсходный текст:\n${sourceContent}`,
                    config
                )

                // Stage 2: For Telegram, add emoji processing
                if (platform === 'tg' && promptMap['rewrite_social_tg_emoji']) {
                    const emojiPrompt = promptMap['rewrite_social_tg_emoji']
                    const emojiConfig = {
                        provider: emojiPrompt.provider,
                        model: emojiPrompt.model,
                        temperature: emojiPrompt.temperature
                    }

                    generatedText = await callAI(
                        emojiPrompt.content,
                        generatedText,
                        emojiConfig
                    )
                }

                results[platform] = generatedText.trim()

                // INCREMENTAL SAVE: Update DB immediately to handle client disconnects or timeouts
                const platformKey = platform === 'site' ? 'draft_longread_site' : `draft_announce_${platform}`
                const { error: updateError } = await supabase
                    .from(tableName as any)
                    .update({ [platformKey]: generatedText.trim() })
                    .eq('id', contentId)

                if (updateError) {
                    console.error(`[GenerateAnnounce] DB Update Error for ${platform}:`, updateError)
                }

            } catch (error: any) {
                console.error(`Error generating announce for ${platform}:`, error)
                results[platform] = `[Ошибка генерации: ${error.message}]`
            }
        }

        // No need for bulk update at the end anymore



        return NextResponse.json({
            success: true,
            results,
            message: `Generated announces for ${Object.keys(results).length} platforms`
        })

    } catch (error: any) {
        console.error('Error in generate-platform-announces:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
