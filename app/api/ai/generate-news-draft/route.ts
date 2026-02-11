import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

interface GenerateNewsDraftRequest {
    news_id: string;
    user_chat_id: number; // Для загрузки изображения в Telegram
}

export async function POST(req: Request) {
    const supabase = await createClient();

    try {
        const { news_id, user_chat_id }: GenerateNewsDraftRequest = await req.json();

        if (!news_id) {
            return NextResponse.json({ error: 'news_id is required' }, { status: 400 });
        }

        // 1. Получаем новость
        const { data: rawNewsItem, error: fetchError } = await supabase
            .from('news_items')
            .select('*') // Нужны cleaned_text, title, возможно existing image_url
            .eq('id', news_id)
            .single();

        if (fetchError || !rawNewsItem) {
            return NextResponse.json({ error: 'News item not found' }, { status: 404 });
        }

        const newsItem = rawNewsItem as any;

        // 2. Получаем промпты и настройки AI
        const [aiSettings, prompts] = await Promise.all([
            supabase.from('project_settings').select('key, value').in('key', [
                'ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url', 'ai_proxy_url'
            ]),
            supabase.from('system_prompts').select('key, content').in('key', [
                'rewrite_longread', 'rewrite_announce', 'image_prompt'
            ])
        ]);

        const settings = aiSettings.data?.reduce<Record<string, string>>((acc, { key, value }) => {
            acc[key] = value ?? '';
            return acc;
        }, {}) ?? {};
        const promptMap = prompts.data?.reduce<Record<string, string>>((acc, { key, content }) => {
            acc[key] = content ?? '';
            return acc;
        }, {}) ?? {};

        // 3. Валидация
        const requiredPrompts = ['rewrite_longread', 'rewrite_announce', 'image_prompt'];
        const missing = requiredPrompts.filter(k => !promptMap[k]);
        if (missing.length > 0) {
            return NextResponse.json({ error: `Missing prompts: ${missing.join(', ')}` }, { status: 500 });
        }

        const apiKey = settings.ai_api_key;
        if (!apiKey) return NextResponse.json({ error: 'AI API Key not set' }, { status: 500 });

        // 4. Настраиваем помощник для AI
        const baseUrl = settings.ai_base_url || 'https://api.openai.com/v1';
        const model = settings.ai_model || 'gpt-4o-mini';
        const proxyUrl = settings.ai_proxy_url;

        const makeAICall = async (systemPrompt: string, userPrompt: string): Promise<string> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            if (settings.ai_provider === 'openrouter') {
                headers['HTTP-Referer'] = 'https://ainews-control.local';
                headers['X-Title'] = 'AiNews Control';
            }

            const body = {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_completion_tokens: 30000 // Явно задаем для лонгридов/моделей рассуждения (~30к символов)
            };

            const fetchOptions: any = {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            };
            if (proxyUrl) fetchOptions.dispatcher = new ProxyAgent(proxyUrl);

            const res = await undiciFetch(`${baseUrl}/chat/completions`, fetchOptions);
            const data: any = await res.json();
            if (!res.ok) throw new Error(`AI Error: ${JSON.stringify(data)}`);

            return data.choices?.[0]?.message?.content || '';
        };

        // 5. Параллельная генерация
        const cleanText = (newsItem as any).cleaned_text || (newsItem as any).summary || newsItem.title; // Фолбэк

        // Динамически импортируем сервисы
        const { generateImage } = await import('@/lib/ai-service');
        const { sendPhotoToTelegram } = await import('@/lib/telegram-service');

        const [longread, announce, imgPromptText] = await Promise.all([
            makeAICall(promptMap.rewrite_longread, cleanText),
            makeAICall(promptMap.rewrite_announce, cleanText),
            makeAICall(promptMap.image_prompt, `TITLE: ${newsItem.title}\nTEXT: ${cleanText}`)
        ]);

        // 6. Этап генерации изображения
        let finalFileId = newsItem.draft_image_file_id;
        let draftImageUrl = newsItem.draft_image_url;

        // Если изображения нет, генерируем
        if (!finalFileId && !newsItem.image_url) {
            try {
                const generatedUrl = await generateImage(imgPromptText);
                draftImageUrl = generatedUrl;

                // Отправляем в Telegram, чтобы получить постоянный File ID
                if (user_chat_id) {
                    const sent = await sendPhotoToTelegram(user_chat_id, generatedUrl, 'News Draft Image');
                    finalFileId = sent.file_id;
                }
            } catch (e) {
                console.error('Image Gen Failed:', e);
            }
        } else if (newsItem.image_url && !finalFileId && user_chat_id) {
            // Если у исходной новости есть изображение, но нет file_id, пробуем загрузить оригинал
            try {
                const sent = await sendPhotoToTelegram(user_chat_id, newsItem.image_url, 'Original News Image');
                finalFileId = sent.file_id;
            } catch (e) {
                console.error('Original Image Upload Failed:', e);
            }
        }

        // 7. Обновляем news_items
        const updatePayload: any = {
            draft_longread: longread,
            draft_announce: announce,
            draft_image_prompt: imgPromptText,
            draft_image_file_id: finalFileId,
            draft_image_url: draftImageUrl,
            status: 'drafts_ready',
            drafts_updated_at: new Date().toISOString()
        };

        const { error: updateError } = await (supabase
            .from('news_items') as any)
            .update(updatePayload)
            .eq('id', news_id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, ...updatePayload });

    } catch (e: any) {
        console.error('Generate News Draft Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
