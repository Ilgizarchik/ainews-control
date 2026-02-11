import { createAdminClient } from '@/lib/supabase/admin';
import { callAI } from './ai-service';
import { scrapeArticleText } from './scraper-service';
import { logErrorToTelegram } from './logger-service';
import { isMarkdown, markdownToHtml } from './markdown-utils';

export async function processApprovedNews(newsId: string) {
    const supabase = createAdminClient();

    // 1. Получаем новость
    const { data: item, error: fetchError } = await (supabase
        .from('news_items')
        .select('*')
        .eq('id', newsId)
        .single() as any);

    if (fetchError || !item) {
        throw new Error('News item not found');
    }

    // 2. Загружаем кастомный селектор, если он есть для этого источника
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
        // Тихо игнорируем, если сопоставление источника не найдено или странное
        console.warn(`[Generation] Could not find custom selector for source: ${item.source_name}`);
    }

    // 2. Скрейпим контент
    let articleText = '';
    try {
        articleText = await scrapeArticleText(item.canonical_url, contentSelector);
        console.log(`[Generation] Scraped text length for ${newsId}: ${articleText.length}`);
    } catch (scrapeErr) {
        console.warn(`[Generation] Scraping failed for ${newsId}:`, scrapeErr);
    }

    // Фолбэк, если скрейпинг не дал ничего полезного
    if (articleText.length < 100) {
        articleText = item.content || item.rss_summary || '';
        console.log(`[Generation] Using fallback content for ${newsId}, length: ${articleText.length}`);
    }

    const sourceContext = `Название: ${item.title}\n\nТекст статьи:\n${articleText}`;

    // 3. Получаем промпты с конфигурацией
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

    // Преобразуем промпты в удобную структуру
    const promptMap = (prompts as any[]).reduce((acc, p) => ({
        ...acc,
        [p.key]: p
    }), {} as Record<string, { content: string, provider?: string, model?: string, temperature?: number }>);

    // Хелпер для получения конфигурации
    const getConfig = (key: string) => {
        const p = promptMap[key];
        if (p) {
            return { provider: p.provider, model: p.model, temperature: p.temperature };
        }
        console.warn(`[Generation] NO CUSTOM CONFIG for '${key}' found. Using global defaults.`);
        return undefined;
    };

    // Хелпер для получения контента
    const getContent = (key: string, fallback: string) => promptMap[key]?.content || fallback;

    // 4. Генерируем контент (последовательно или параллельно)

    try {
        const { generateImage } = await import('./ai-service');
        const { sendPhotoToTelegram } = await import('./telegram-service');

        // Генерируем тексты
        const [generatedLongread, generatedTitle] = await Promise.all([
            callAI(getContent('rewrite_longread', 'Напиши лонгрид на основе статьи.'), sourceContext, { ...getConfig('rewrite_longread'), maxTokens: 8000 }),
            callAI(getContent('rewrite_title', 'Придумай заголовок.'), sourceContext, getConfig('rewrite_title'))
        ]);

        // Генерируем анонс
        const generatedAnnounce = await callAI(
            getContent('rewrite_announce', 'Напиши анонс для Telegram.'),
            `LONGREAD:\n${generatedLongread}`,
            getConfig('rewrite_announce')
        );

        // Конвертируем Markdown в HTML при необходимости (для лонгрида)
        let finalLongread = generatedLongread;
        if (isMarkdown(generatedLongread)) {
            finalLongread = markdownToHtml(generatedLongread);
        }

        // Генерируем промпт для изображения
        const generatedImagePrompt = await callAI(
            getContent('image_prompt', 'Опиши картинку для статьи.'),
            `TITLE: ${generatedTitle}\n\nLONGREAD: ${finalLongread.substring(0, 1000)}`,
            getConfig('image_prompt')
        );

        // Генерируем изображение и загружаем в Telegram
        let imageFileId = null;
        let imageUrl = null;
        try {
            if (generatedImagePrompt) {
                imageUrl = await generateImage(generatedImagePrompt);

                // Получаем ID чата для загрузки черновых изображений
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
            // Ошибка по изображению не блокирует процесс — продолжаем с текстом
        }

        // Генерируем контент для соцсетей по рецептам
        const platformAnnounces: Record<string, string> = {};

        // Проверяем настройку автогенерации
        const { data: autoGenSetting } = await supabase
            .from('project_settings')
            .select('value')
            .eq('key', 'auto_generate_social_posts')
            .eq('project_key', 'ainews')
            .single();

        const shouldAutoGenerate = autoGenSetting?.value === 'true';

        if (shouldAutoGenerate) {
            try {
                const { data: recipes } = await (supabase
                    .from('publish_recipes')
                    .select('platform')
                    .eq('is_active', true) as any);

                if (recipes && recipes.length > 0) {
                    const platforms = Array.from(new Set(recipes.map((r: any) => r.platform))) as string[];

                    // Получаем промпты
                    const promptKeys = platforms.map((p: any) => `rewrite_social_${p.toLowerCase()}`);
                    if (platforms.includes('tg')) promptKeys.push('rewrite_social_tg_emoji');

                    const { data: socialPrompts } = await (supabase
                        .from('system_prompts')
                        .select('key, content, provider, model, temperature') // Получаем полный конфиг
                        .in('key', promptKeys) as any);

                    const socialPromptMap = (socialPrompts as any[] || []).reduce((acc, p) => ({ ...acc, [p.key]: p }), {} as Record<string, any>);

                    for (const platform of platforms) {
                        const promptKey = `rewrite_social_${platform.toLowerCase()}`;
                        const promptData = socialPromptMap[promptKey];

                        if (promptData) {
                            // Используем generatedAnnounce как базу, а для 'site' — лонгрид
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

        // 5. Обновляем базу
        const updatePayload: any = {
            draft_title: generatedTitle,
            draft_longread: finalLongread,
            draft_announce: generatedAnnounce,
            draft_image_prompt: generatedImagePrompt,
            draft_image_file_id: imageFileId,
            draft_image_url: imageUrl,
            original_text: articleText, // <--- Сохраняем исходный скрейпнутый текст для будущей регенерации
            status: 'drafts_ready', // Этап 1 завершен
            updated_at: new Date().toISOString(),
            ...platformAnnounces
        };

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

    // 1. Получаем элемент
    const { data: item, error: fetchError } = await (supabase
        .from('news_items')
        .select('*')
        .eq('id', newsId)
        .single() as any);

    if (fetchError || !item) {
        console.error(`[Gate1] Failed to fetch item ${newsId}:`, fetchError);
        return false;
    }


    // 2. Получаем системный промпт для Gate 1
    const { data: promptData } = await (supabase
        .from('system_prompts')
        .select('content, provider, model, temperature')
        .eq('key', 'gate_filter')
        .single() as any);

    if (promptData) {
    } else {
        console.warn(`[Gate1] No configuration found for key: gate_filter. Using fallback prompt & global settings.`);
    }

    // Фолбэк-промпт, если его нет в БД
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
    // Конфиг
    const config: any = promptData ? {
        provider: promptData.provider,
        model: promptData.model,
        temperature: promptData.temperature,
        responseFormat: { type: 'json_object' }
    } : {
        responseFormat: { type: 'json_object' }
    };

    // 3. Готовим пользовательский контент
    const userContent = `Title: ${item.title}\nSource: ${item.source_name}\nSummary: ${item.rss_summary || 'No summary'}\nLink: ${item.canonical_url}`;

    try {
        // 4. Вызываем AI
        const responseText = await callAI(systemPrompt, userContent, config);

        // 5. Парсим JSON
        let result: any = {};
        try {
            // Устойчивое извлечение JSON: ищем первую { и последнюю }
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
            // Фолбэк — безопасно отправить на ручную проверку, если JSON сломан
            result = {
                decision: 'send',
                score: 50,
                reason: 'AI Parse Error: Invalid JSON Format',
                tags: ['error']
            };
        }

        // Нормализуем решение
        const decisionStr = (result.decision || '').toLowerCase();
        const decision = (decisionStr === 'send' || decisionStr === 'approve' || decisionStr === 'yes') ? 'send' : 'block';


        // 6. Обновляем БД
        // Если блок -> status = 'rejected' (обычно скрыто из Pending)
        // Если send -> status = 'found', но gate1_decision установлен (показывается в Pending)
        const updatePayload: any = {
            gate1_decision: decision,
            gate1_score: result.score || 0,
            gate1_reason: result.reason || 'No reason provided',
            gate1_tags: result.tags || [],
            gate1_processed_at: new Date().toISOString()
        };

        // Обновляем статус для заблокированных элементов:
        if (decision === 'block') {
            updatePayload.status = 'rejected';
        }
        // Если отправлено, сохраняем статус 'found' (или можно 'pending_approval', но enum в БД может быть строгим)

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
