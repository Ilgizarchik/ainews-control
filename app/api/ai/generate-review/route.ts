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
}

export async function POST(req: Request) {
    const supabase = await createClient();

    try {
        const { title_seed, factpack, draft_image_file_id, user_chat_id }: ReviewGenerationRequest = await req.json();


        if (!title_seed) {
            return NextResponse.json({ error: 'title_seed is required' }, { status: 400 });
        }

        // 1. Получаем настройки AI и промты из БД
        const [aiSettings, prompts] = await Promise.all([
            supabase.from('project_settings').select('key, value').in('key', [
                'ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url', 'ai_proxy_url', 'review_ai_model'
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

        if (!apiKey) {
            return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
        }

        // Helper function for calling AI
        const makeAICall = async (systemPrompt: string, userPrompt: string): Promise<string> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };

            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = 'https://ainews-control.local';
                headers['X-Title'] = 'AiNews Control';
            }

            const body = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_completion_tokens: 2000
            };

            const fetchOptions: any = {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            };

            if (proxyUrl) {
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
                `Title: ${title_seed}\nFacts: ${factsContext}`
            ),
            makeAICall(
                promptMap.review_title,
                `CONTEXT:\nTitle: ${title_seed}\nFacts: ${factsContext}`
            )
        ]);

        // Шаг 2: Генерируем анонс на основе лонгрида
        const finalAnnounce = await makeAICall(
            promptMap.review_announce,
            `LONGREAD_HTML:\n${longread}`
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
