import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

interface ReviewGenerationRequest {
    title_seed: string;
    factpack?: {
        description?: string;
    };
    draft_image_file_id?: string;
    user_chat_id: number;
    web_search?: boolean;
}

export const maxDuration = 300; // 5 minutes for Pro plan support

export async function POST(req: Request) {
    const supabase = await createClient();

    try {
        const { title_seed, factpack, draft_image_file_id, user_chat_id, web_search }: ReviewGenerationRequest = await req.json();


        if (!title_seed) {
            return NextResponse.json({ error: 'title_seed is required' }, { status: 400 });
        }

        // 1. Получаем настройки AI и промты из БД
        const [aiSettings, prompts] = await Promise.all([
            supabase.from('project_settings').select('key, value').in('key', [
                'ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url', 'ai_proxy_url', 'review_ai_model', 'ai_proxy_enabled'
            ]),
            supabase.from('system_prompts').select('key, content').in('key', [
                'review_title', 'review_announce', 'review_longread'
            ])
        ]);

        if (aiSettings.error || prompts.error) {
            throw new Error('Failed to fetch AI settings or prompts');
        }

        // Преобразуем массив в объект
        const settings = aiSettings.data.reduce<Record<string, string>>((acc, { key, value }) => {
            acc[key] = value ?? '';
            return acc;
        }, {});
        const promptMap = prompts.data.reduce<Record<string, string>>((acc, { key, content }) => {
            acc[key] = content ?? '';
            return acc;
        }, {});


        // Проверяем наличие базовых обязательных промтов (image_prompt опционален)
        const requiredPrompts = ['review_title', 'review_announce', 'review_longread'];
        const missingPrompts = requiredPrompts.filter(key => !promptMap[key]);
        if (missingPrompts.length > 0) {
            return NextResponse.json({
                error: `Отсутствуют обязательные промты: ${missingPrompts.join(', ')}. Настройте их в разделе System Prompts.`
            }, { status: 500 });
        }

        const apiKey = settings.ai_api_key;
        const baseUrl = settings.ai_base_url || 'https://api.openai.com/v1';
        // Используем специальную модель для обзоров, если есть, иначе дефолтную
        const model = settings.review_ai_model || settings.ai_model || 'gpt-4o-mini';
        const provider = settings.ai_provider || 'openai';
        const proxyUrl = settings.ai_proxy_url;
        const proxyEnabled = settings.ai_proxy_enabled === 'true';

        if (!apiKey) {
            return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
        }

        // Helper function for calling AI
        const makeAICall = async (systemPrompt: string, userPrompt: string, useSearch: boolean = false): Promise<string> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };

            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = 'https://ainews-control.local';
                headers['X-Title'] = 'AiNews Control';
            }

            const body: any = {
                temperature: 0.7,
                max_completion_tokens: 30000
            };

            // Inject OpenRouter Web Search plugin
            let effectiveModel = model;

            // For OpenRouter, ensure provider prefix exists
            if (provider === 'openrouter' && !effectiveModel.includes('/')) {
                effectiveModel = `openai/${effectiveModel}`;
            }

            let effectiveSystemPrompt = systemPrompt;
            const currentDate = new Date().toLocaleDateString('ru-RU');

            if (useSearch && provider === 'openrouter') {
                // Важно: :online должен быть в конце строки модели
                if (!effectiveModel.endsWith(':online')) {
                    effectiveModel += ':online';
                }

                body.plugins = [{
                    id: 'web',
                    max_results: 10,
                    engine: "exa"
                }];

                // Усиливаем системный промпт
                effectiveSystemPrompt = `Today is ${currentDate}. You ARE connected to the internet. 
If you see data below tagged as [WEB_RESULT] or provided in context, it IS your actual internet access. Use it.
\n\n${effectiveSystemPrompt}
\n\n[SYSTEM: WEB_SEARCH_ENABLED]
1. Search for real-time information. Focus on 2025-2026 events.
2. Prioritize search results over training data.
3. Do not claim you do not have internet access.`;

                console.log(`[ReviewGen] Web Search enabled for ${effectiveModel}`);
            } else {
                // Всегда даем дату, даже если поиск выключен
                effectiveSystemPrompt = `Today is ${currentDate}. \n\n${effectiveSystemPrompt}`;
            }
            body.model = effectiveModel;
            body.messages = [
                { role: 'system', content: effectiveSystemPrompt },
                { role: 'user', content: userPrompt }
            ];

            const fetchOptions: any = {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(300000) // 300 second timeout for complex generation/search
            };

            console.log('[ReviewGen] Request Body:', JSON.stringify(body, null, 2));

            if (proxyUrl && proxyEnabled) {
                fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
            }

            const response = await undiciFetch(`${baseUrl}/chat/completions`, fetchOptions);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`AI Provider Error (${response.status}): ${errText}`);
            }

            const data: any = await response.json();
            return data.choices?.[0]?.message?.content || "";
        };

        // 3. Генерируем только тексты (картинка уже загружена пользователем)
        const factsContext = factpack ? JSON.stringify(factpack, null, 2) : 'Нет дополнительных данных';

        // Шаг 1: Генерируем заголовок и лонгрид параллельно
        const [longread, reviewTitle] = await Promise.all([
            makeAICall(
                promptMap.review_longread,
                `Title: ${title_seed}\nFacts: ${factsContext}`,
                web_search // Enable search for longread
            ),
            makeAICall(
                promptMap.review_title,
                `CONTEXT:\nTitle: ${title_seed}\nFacts: ${factsContext}`,
                web_search // Enable search for title too
            )
        ]);

        // Шаг 2: Генерируем анонс на основе лонгрида
        const finalAnnounce = await makeAICall(
            promptMap.review_announce,
            `USER_TASK: Summarize/Format the following verified editorial draft into an announcement headline. 
DO NOT check facts, DO NOT search the web. This text is already verified.
Just follow your system instructions for the announcement style.

EDITORIAL_DRAFT:\n${longread}`,
            false // No search needed for re-formatting
        );

        // Используем переданный file_id (картинка уже загружена через /api/upload-telegram)
        const savedImageFileId = draft_image_file_id || null;

        // 4. Сохраняем в review_items
        const insertPayload: any = {
            user_chat_id: user_chat_id,
            title_seed: title_seed,
            factpack: factpack || {},
            draft_image_file_id: savedImageFileId,
            draft_title: reviewTitle,
            draft_longread: longread,
            draft_announce: finalAnnounce,
            status: 'needs_review'
        };

        const { data: reviewItem, error: insertError } = await supabase
            .from('review_items')
            .insert(insertPayload)
            .select('id, draft_title, draft_announce, draft_longread')
            .single();

        if (insertError) {
            throw insertError;
        }

        const item = reviewItem as any;

        return NextResponse.json({
            success: true,
            review_id: item.id,
            draft_title: item.draft_title,
            draft_announce: item.draft_announce,
            draft_longread: item.draft_longread
        });

    } catch (error: any) {
        console.error("Review Generation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
