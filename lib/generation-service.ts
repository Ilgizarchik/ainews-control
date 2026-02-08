import { createAdminClient } from '@/lib/supabase/admin';
import { callAI } from './ai-service';
import { scrapeArticleText } from './scraper-service';
import { logErrorToTelegram } from './logger-service';
import { isMarkdown, markdownToHtml } from './markdown-utils';

export async function processApprovedNews(newsId: string) {
    const supabase = createAdminClient();

    // 1. Get news item
    const { data: item, error: fetchError } = await (supabase
        .from('news_items')
        .select('*')
        .eq('id', newsId)
        .single() as any);

    if (fetchError || !item) {
        throw new Error('News item not found');
    }

    // 2. Load custom selector if available for this source
    let contentSelector: string | undefined = undefined;
    try {
        const { data: source } = await supabase
            .from('ingestion_sources')
            .select('selectors')
            .eq('name', item.source_name)
            .single() as any;

        if (source?.selectors?.content_selector) {
            contentSelector = source.selectors.content_selector;
        }
    } catch {
        // Silently fail if source mapping is not found or weird
        console.warn(`[Generation] Could not find custom selector for source: ${item.source_name}`);
    }

    // 2. Scrape content
    let articleText = '';
    try {
        articleText = await scrapeArticleText(item.canonical_url, contentSelector);
        console.log(`[Generation] Scraped text length for ${newsId}: ${articleText.length}`);
    } catch (scrapeErr) {
        console.warn(`[Generation] Scraping failed for ${newsId}:`, scrapeErr);
    }

    // Fallback if scraping returned nothing useful
    if (articleText.length < 100) {
        articleText = item.content || item.rss_summary || '';
        console.log(`[Generation] Using fallback content for ${newsId}, length: ${articleText.length}`);
    }

    const sourceContext = `Название: ${item.title}\n\nТекст статьи:\n${articleText}`;

    // 3. Get prompts with configurations
    const { data: prompts, error: promptsError } = await (supabase
        .from('system_prompts')
        .select('key, content, provider, model, temperature')
        .in('key', ['rewrite_title', 'rewrite_longread', 'rewrite_announce', 'image_prompt']) as any);

    if (promptsError || !prompts || prompts.length === 0) {
        console.error('[Generation] Failed to fetch system prompts. Error:', promptsError);
        console.error('[Generation] Keys requested:', ['rewrite_title', 'rewrite_longread', 'rewrite_announce', 'image_prompt']);
        console.error('[Generation] Prompts found:', prompts ? prompts.length : 0);
        throw new Error(`Failed to fetch system prompts: ${promptsError?.message || 'No prompts found in DB for required keys'}`);
    }

    // Map prompts to easy access objects
    const promptMap = (prompts as any[]).reduce((acc, p) => ({
        ...acc,
        [p.key]: p
    }), {} as Record<string, { content: string, provider?: string, model?: string, temperature?: number }>);

    // Helper to get config
    const getConfig = (key: string) => {
        const p = promptMap[key];
        if (p) {
            return { provider: p.provider, model: p.model, temperature: p.temperature };
        }
        console.warn(`[Generation] NO CUSTOM CONFIG for '${key}' found. Using global defaults.`);
        return undefined;
    };

    // Helper to get content
    const getContent = (key: string, fallback: string) => promptMap[key]?.content || fallback;

    // 4. Generate content (sequential or parallel)

    try {
        const { generateImage } = await import('./ai-service');
        const { sendPhotoToTelegram } = await import('./telegram-service');

        // Generate Texts
        const [generatedLongread, generatedTitle] = await Promise.all([
            callAI(getContent('rewrite_longread', 'Напиши лонгрид на основе статьи.'), sourceContext, { ...getConfig('rewrite_longread'), maxTokens: 8000 }),
            callAI(getContent('rewrite_title', 'Придумай заголовок.'), sourceContext, getConfig('rewrite_title'))
        ]);

        // Generate Announce
        const generatedAnnounce = await callAI(
            getContent('rewrite_announce', 'Напиши анонс для Telegram.'),
            `LONGREAD:\n${generatedLongread}`,
            getConfig('rewrite_announce')
        );

        // Convert Markdown to HTML if needed (for longread)
        let finalLongread = generatedLongread;
        if (isMarkdown(generatedLongread)) {
            finalLongread = markdownToHtml(generatedLongread);
        }

        // Generate Image Prompt
        const generatedImagePrompt = await callAI(
            getContent('image_prompt', 'Опиши картинку для статьи.'),
            `TITLE: ${generatedTitle}\n\nLONGREAD: ${finalLongread.substring(0, 1000)}`,
            getConfig('image_prompt')
        );

        // Generate Image & Upload to Telegram
        let imageFileId = null;
        let imageUrl = null;
        try {
            if (generatedImagePrompt) {
                imageUrl = await generateImage(generatedImagePrompt);

                // Get chat ID for uploading draft images
                const { getDraftChatId } = await import('./telegram-service');
                const globalDraftChatId = await getDraftChatId();
                const draftChatId = globalDraftChatId || item.approve1_chat_id;

                if (draftChatId && imageUrl) {
                    const sent = await sendPhotoToTelegram(draftChatId, imageUrl, 'Draft Image');
                    imageFileId = sent.file_id;
                } else {
                    console.warn('⚠️ [5/5] Skipping Telegram upload: No draft chat ID configured or no image URL.');
                }
            } else {
            }
        } catch (imgError: any) {
            const errorMsg = imgError instanceof Error ? imgError.message : String(imgError);
            console.error('❌ Image generation/upload stage failed:', imgError);
            await logErrorToTelegram(
                `Не удалось сгенерировать/загрузить изображение для новости ${newsId}: ${errorMsg}`,
                'processApprovedNews (Image Stage)'
            );
            // Non-blocking error for image - continue with text content
        }

        // Generate Social Content based on Recipes
        const platformAnnounces: Record<string, string> = {};

        // Check auto-generate setting
        const { data: autoGenSetting } = await supabase
            .from('project_settings')
            .select('value')
            .eq('key', 'auto_generate_social_posts')
            .eq('project_key', 'ainews')
            .single();

        const shouldAutoGenerate = autoGenSetting?.value === 'true';

        if (!shouldAutoGenerate) {
        } else {
            try {
                const { data: recipes } = await (supabase
                    .from('publish_recipes')
                    .select('platform')
                    .eq('is_active', true) as any);

                if (recipes && recipes.length > 0) {
                    const platforms = Array.from(new Set(recipes.map((r: any) => r.platform))) as string[];

                    // Get prompts
                    const promptKeys = platforms.map((p: any) => `rewrite_social_${p.toLowerCase()}`);
                    if (platforms.includes('tg')) promptKeys.push('rewrite_social_tg_emoji');

                    const { data: socialPrompts } = await (supabase
                        .from('system_prompts')
                        .select('key, content, provider, model, temperature') // Get full config
                        .in('key', promptKeys) as any);

                    const socialPromptMap = (socialPrompts as any[] || []).reduce((acc, p) => ({ ...acc, [p.key]: p }), {} as Record<string, any>);

                    for (const platform of platforms) {
                        const promptKey = `rewrite_social_${platform.toLowerCase()}`;
                        const promptData = socialPromptMap[promptKey];

                        if (promptData) {
                            // Use generatedAnnounce as base, except 'site' uses longread
                            const base = platform === 'site' ? finalLongread : generatedAnnounce;

                            const config = { provider: promptData.provider, model: promptData.model, temperature: promptData.temperature };

                            let text = await callAI(promptData.content, `TITLE: ${generatedTitle}\n\nTEXT: ${base}`, config);

                            if (platform === 'tg' && socialPromptMap['rewrite_social_tg_emoji']) {
                                const emojiPrompt = socialPromptMap['rewrite_social_tg_emoji'];
                                const emojiConfig = { provider: emojiPrompt.provider, model: emojiPrompt.model, temperature: emojiPrompt.temperature };
                                text = await callAI(emojiPrompt.content, text, emojiConfig);
                            }

                            platformAnnounces[`draft_announce_${platform}`] = text;
                        } else {
                            console.warn(`⚠️ [Generation] Missing prompt for platform '${platform}' (key: ${promptKey})`);
                            await logErrorToTelegram(
                                `Отсутствует промпт для платформы '${platform}' (ключ: ${promptKey}). Создайте промпт в настройках.`,
                                'processApprovedNews (Social Generation)'
                            );
                        }
                    }
                }
            } catch (socialError) {
                console.error('❌ Social generation failed:', socialError);
            }
        }

        // 5. Update database
        const updatePayload: any = {
            draft_title: generatedTitle,
            draft_longread: finalLongread,
            draft_announce: generatedAnnounce,
            draft_image_prompt: generatedImagePrompt,
            draft_image_file_id: imageFileId,
            draft_image_url: imageUrl,
            status: 'drafts_ready', // Stage 1 completed
            updated_at: new Date().toISOString(),
            ...platformAnnounces
        };

        // If not generated, make sure fields are null/empty if that's desired, or just don't update them (they are null by default)
        // Since payload spreads ...platformAnnounces, empty object means no update to those fields. Correct.

        const { error: updateError } = await ((supabase
            .from('news_items') as any)
            .update(updatePayload)
            .eq('id', newsId) as any);

        if (updateError) throw updateError;

        return { success: true };
    } catch (error) {
        console.error(`[Generation] Error in generation process for news ${newsId}:`, error);

        try {
            await ((supabase
                .from('news_items') as any)
                .update({
                    status: 'error',
                    gate1_reason: `Generation Error: ${error instanceof Error ? error.message : String(error)}`
                })
                .eq('id', newsId) as any);
        } catch (dbError) {
            console.error('Failed to update error status in DB:', dbError);
        }

        await logErrorToTelegram(error, `processApprovedNews (${newsId})`);
        throw error;
    }
}

export async function processGate1(newsId: string) {
    const supabase = createAdminClient();

    // 1. Fetch Item
    const { data: item, error: fetchError } = await (supabase
        .from('news_items')
        .select('*')
        .eq('id', newsId)
        .single() as any);

    if (fetchError || !item) {
        console.error(`[Gate1] Failed to fetch item ${newsId}:`, fetchError);
        return false;
    }


    // 2. Fetch System Prompt for Gate 1
    const { data: promptData } = await (supabase
        .from('system_prompts')
        .select('content, provider, model, temperature')
        .eq('key', 'gate_filter')
        .single() as any);

    if (promptData) {
    } else {
        console.warn(`[Gate1] No configuration found for key: gate_filter. Using fallback prompt & global settings.`);
    }

    // Fallback prompt if not in DB
    const systemPrompt = promptData?.content || `
You are an expert news editor for a hunting and outdoor portal.
Analyze the incoming news item and decide if it is relevant for our audience (hunters, shooters, outdoor enthusiasts).
Return ONLY valid JSON in this format:
{
    "decision": "send" (if good) or "block" (if spam/irrelevant),
    "score": number (0-100 relevance score),
    "reason": "short explanation in Russian",
    "tags": ["tag1", "tag2"]
}
`;
    // Config
    const config: any = promptData ? {
        provider: promptData.provider,
        model: promptData.model,
        temperature: promptData.temperature,
        responseFormat: { type: 'json_object' }
    } : {
        responseFormat: { type: 'json_object' }
    };

    // 3. Prepare User Content
    const userContent = `Title: ${item.title}\nSource: ${item.source_name}\nSummary: ${item.rss_summary || 'No summary'}\nLink: ${item.canonical_url}`;

    try {
        // 4. Call AI
        const responseText = await callAI(systemPrompt, userContent, config);

        // 5. Parse JSON
        let result: any = {};
        try {
            // Robust JSON extraction: find the first { and last }
            const startIdx = responseText.indexOf('{');
            const endIdx = responseText.lastIndexOf('}');

            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const jsonContent = responseText.substring(startIdx, endIdx + 1);
                result = JSON.parse(jsonContent);
            } else {
                throw new Error('No JSON object found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse Gate 1 AI response:', responseText, parseError);
            // Fallback - safe to approve for manual check if JSON fails
            result = {
                decision: 'send',
                score: 50,
                reason: 'AI Parse Error: Invalid JSON Format',
                tags: ['error']
            };
        }

        // Normalize decision
        const decisionStr = (result.decision || '').toLowerCase();
        const decision = (decisionStr === 'send' || decisionStr === 'approve' || decisionStr === 'yes') ? 'send' : 'block';


        // 6. Update DB
        // If blocked -> status = 'blocked' (hidden from Pending usually)
        // If send -> status = 'found' but gate1_decision is set (shows in Pending)
        const updatePayload: any = {
            gate1_decision: decision,
            gate1_score: result.score || 0,
            gate1_reason: result.reason || 'No reason provided',
            gate1_tags: result.tags || [],
            gate1_processed_at: new Date().toISOString()
        };

        // Update status for blocked items:
        // User requested NOT to block completely, but just show with low score.
        // So we keep status='found' (Pending items) even if decision is block.
        // But we keep gate1_decision='block' so UI can show it as "Low Relevance"

        /* 
        if (decision === 'block') {
            updatePayload.status = 'blocked'; 
        } 
        */
        // If sent, we keep 'found' status (or change to 'pending_approval' if you prefer, but DB enum might be strict)

        const { error: updateError } = await ((supabase
            .from('news_items') as any)
            .update(updatePayload)
            .eq('id', newsId) as any);

        if (updateError) {
            console.error('[Gate1] DB Update Error:', updateError);
            throw updateError;
        }

        return decision === 'send';

    } catch (e: any) {
        console.error(`[Gate1] Error processing ${newsId}:`, e);
        await logErrorToTelegram(`Gate 1 Error for ${newsId}: ${e.message}`, 'processGate1');
        return false;
    }
}
