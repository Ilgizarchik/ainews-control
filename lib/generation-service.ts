import { createClient } from '@/lib/supabase/server';
import { callAI } from './ai-service';
import { scrapeArticleText } from './scraper-service';

export async function processApprovedNews(newsId: string) {
    const supabase = await createClient();

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
    } catch (e) {
        // Silently fail if source mapping is not found or weird
        console.warn(`[Generation] Could not find custom selector for source: ${item.source_name}`);
    }

    // 2. Scrape content
    console.log(`[Generation] Scraping content from: ${item.canonical_url} (Selector: ${contentSelector || 'Readability'})`);
    const articleText = await scrapeArticleText(item.canonical_url, contentSelector);
    const sourceContext = `Название: ${item.title}\n\nТекст статьи:\n${articleText}`;

    // 3. Get prompts with configurations
    const { data: prompts, error: promptsError } = await (supabase
        .from('system_prompts')
        .select('key, content, provider, model, temperature')
        .in('key', ['rewrite_title', 'rewrite_longread', 'rewrite_announce', 'image_prompt']) as any);

    if (promptsError || !prompts) {
        throw new Error('Failed to fetch system prompts');
    }

    // Map prompts to easy access objects
    const promptMap = (prompts as any[]).reduce((acc, p) => ({
        ...acc,
        [p.key]: p
    }), {} as Record<string, { content: string, provider?: string, model?: string, temperature?: number }>);

    // Helper to get config
    const getConfig = (key: string) => {
        const p = promptMap[key];
        return p ? { provider: p.provider, model: p.model, temperature: p.temperature } : undefined;
    };

    // Helper to get content
    const getContent = (key: string, fallback: string) => promptMap[key]?.content || fallback;

    // 4. Generate content (sequential or parallel)
    console.log(`[Generation] Starting AI generation for news: ${newsId}`);

    try {
        const { generateImage } = await import('./ai-service');
        const { sendPhotoToTelegram } = await import('./telegram-service');

        // Generate Texts
        console.log('📝 [1/5] Generating Longread and Title...');
        const [generatedLongread, generatedTitle] = await Promise.all([
            callAI(getContent('rewrite_longread', 'Напиши лонгрид на основе статьи.'), sourceContext, getConfig('rewrite_longread')),
            callAI(getContent('rewrite_title', 'Придумай заголовок.'), sourceContext, getConfig('rewrite_title'))
        ]);
        console.log('✅ [1/5] Texts generated.');

        // Generate Announce
        console.log('📢 [2/5] Generating Announce...');
        const generatedAnnounce = await callAI(
            getContent('rewrite_announce', 'Напиши анонс для Telegram.'),
            `LONGREAD:\n${generatedLongread}`,
            getConfig('rewrite_announce')
        );
        console.log('✅ [2/5] Announce generated.');

        // Generate Image Prompt
        console.log('🎨 [3/5] Generating Image Prompt...');
        const generatedImagePrompt = await callAI(
            getContent('image_prompt', 'Опиши картинку для статьи.'),
            `TITLE: ${generatedTitle}\n\nLONGREAD: ${generatedLongread.substring(0, 1000)}`,
            getConfig('image_prompt')
        );
        console.log('✅ [3/5] Image Prompt generated.');

        // Generate Image & Upload to Telegram
        let imageFileId = null;
        let imageUrl = null;
        try {
            if (generatedImagePrompt) {
                console.log('🖼️ [4/5] Generating Image via AI...');
                imageUrl = await generateImage(generatedImagePrompt);
                console.log('✅ [4/5] Image generated:', imageUrl);

                // Get approve chat ID (or use a default) to store file
                const approveChatId = item.approve1_chat_id || (await getApproveChatId(supabase));

                if (approveChatId && imageUrl) {
                    console.log(`📤 [5/5] Uploading to Telegram chat ${approveChatId}...`);
                    const sent = await sendPhotoToTelegram(approveChatId, imageUrl, 'Draft Image');
                    imageFileId = sent.file_id;
                    console.log('✅ [5/5] Uploaded to Telegram. File ID:', imageFileId);
                } else {
                    console.log('⚠️ [5/5] Skipping Telegram upload: No chat ID or Image URL.');
                }
            } else {
                console.log('⚠️ [3/5] No image prompt generated, skipping image.');
            }
        } catch (imgError) {
            console.error('❌ Image generation/upload stage failed:', imgError);
            // Non-blocking error for image
        }

        // Generate Social Content based on Recipes
        const platformAnnounces: Record<string, string> = {};
        try {
            console.log('[Generation] Checking active publish recipes for social content...');
            const { data: recipes } = await (supabase
                .from('publish_recipes')
                .select('platform')
                .eq('is_active', true) as any);

            if (recipes && recipes.length > 0) {
                const platforms = Array.from(new Set(recipes.map((r: any) => r.platform)));
                console.log(`[Generation] Found active platforms: ${platforms.join(', ')}`);

                // Get prompts
                const promptKeys = platforms.map((p: any) => `rewrite_social_${p}`);
                if (platforms.includes('tg')) promptKeys.push('rewrite_social_tg_emoji');

                const { data: socialPrompts } = await (supabase
                    .from('system_prompts')
                    .select('key, content, provider, model, temperature') // Get full config
                    .in('key', promptKeys) as any);

                const socialPromptMap = (socialPrompts as any[] || []).reduce((acc, p) => ({ ...acc, [p.key]: p }), {} as Record<string, any>);

                for (const platform of platforms) {
                    const promptKey = `rewrite_social_${platform}`;
                    const promptData = socialPromptMap[promptKey];

                    if (promptData) {
                        console.log(`📝 Generating for ${platform}...`);
                        // Use generatedAnnounce as base, except 'site' uses longread
                        const base = platform === 'site' ? generatedLongread : generatedAnnounce;

                        const config = { provider: promptData.provider, model: promptData.model, temperature: promptData.temperature };

                        let text = await callAI(promptData.content, `TITLE: ${generatedTitle}\n\nTEXT: ${base}`, config);

                        if (platform === 'tg' && socialPromptMap['rewrite_social_tg_emoji']) {
                            const emojiPrompt = socialPromptMap['rewrite_social_tg_emoji'];
                            const emojiConfig = { provider: emojiPrompt.provider, model: emojiPrompt.model, temperature: emojiPrompt.temperature };
                            text = await callAI(emojiPrompt.content, text, emojiConfig);
                        }

                        platformAnnounces[`draft_announce_${platform}`] = text;
                    }
                }
            }
        } catch (socialError) {
            console.error('❌ Social generation failed:', socialError);
        }

        // 5. Update database
        const updatePayload: any = {
            draft_title: generatedTitle,
            draft_longread: generatedLongread,
            draft_announce: generatedAnnounce,
            draft_image_prompt: generatedImagePrompt,
            draft_image_file_id: imageFileId,
            draft_image_url: imageUrl,
            status: 'drafts_ready', // Stage 1 completed
            updated_at: new Date().toISOString(),
            ...platformAnnounces
        };

        const { error: updateError } = await ((supabase
            .from('news_items') as any)
            .update(updatePayload)
            .eq('id', newsId) as any);

        if (updateError) throw updateError;

        console.log(`[Generation] Successfully generated drafts for news: ${newsId}`);
        return { success: true };

    } catch (error) {
        // ... (keep existing error handling)
        console.error(`[Generation] Error in generation process for news ${newsId}:`, error);

        await ((supabase
            .from('news_items') as any)
            .update({
                status: 'error',
                gate1_reason: `Generation Error: ${error instanceof Error ? error.message : String(error)}`
            })
            .eq('id', newsId) as any);

        throw error;
    }
}

async function getApproveChatId(supabase: any) {
    const { data } = await supabase.from('project_settings').select('value').eq('key', 'telegram_approve_chat_id').single();
    if (data?.value) return data.value;

    // Fallback: fetch from telegram_chats table
    const { data: chats } = await supabase.from('telegram_chats').select('chat_id').eq('purpose', 'approve').single();
    return chats?.chat_id;
}
