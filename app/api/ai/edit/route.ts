import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

export async function POST(req: Request) {
    const supabase = await createClient();
    try {
        const { text, instruction, apiKey, baseUrl, model, provider, proxyUrl, itemId, itemType } = await req.json();

        // 0. Сохраняем историю правок
        // Хелпер для проверки формата UUID (8-4-4-4-12)
        const isUUID = (str: any) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(str)

        const validItemId = itemId && isUUID(itemId) ? itemId : null;

        console.log('[AI Edit API] Request:', { itemId, itemType, validItemId, textLen: text?.length, instruction })

        if (validItemId) {
            let table = itemType === 'news' ? 'news_items' : 'review_items'

            try {
                // 1. Пробуем основную таблицу
                let { data: current, error: fetchError } = await supabase
                    .from(table)
                    .select('correction_history')
                    .eq('id', validItemId)
                    .maybeSingle()

                // 2. Фолбэк на другую таблицу, если не найдено
                if (!current && !fetchError) {
                    const fallbackTable = table === 'news_items' ? 'review_items' : 'news_items'
                    const { data: fallbackCurrent, error: fallbackError } = await supabase
                        .from(fallbackTable)
                        .select('correction_history')
                        .eq('id', validItemId)
                        .maybeSingle()

                    if (fallbackCurrent) {
                        current = fallbackCurrent
                        table = fallbackTable // Обновляем таблицу для последующего апдейта
                        console.log('[AI Edit API] Item found in fallback table:', table)
                    }
                }

                if (fetchError) {
                    console.error('[AI Edit API] Error fetching history:', fetchError)
                }

                console.log('[AI Edit API] Current history found:', !!current, current?.correction_history?.length, 'in table:', table)

                // Продолжаем только если элемент существует
                if (current) {
                    const history = Array.isArray(current?.correction_history)
                        ? current.correction_history
                        : []

                    // Добавляем новую инструкцию
                    const safeText = text || ''
                    const newHistoryItem = {
                        date: new Date().toISOString(),
                        instruction: instruction || '',
                        original_text_snippet: safeText.substring(0, 100) + (safeText.length > 100 ? '...' : '')
                    }
                    history.push(newHistoryItem)

                    console.log('[AI Edit API] Saving new history:', history.length, 'items', 'to', table)

                    // Обновляем историю элемента
                    const { error: updateError } = await supabase
                        .from(table)
                        .update({ correction_history: history })
                        .eq('id', validItemId)

                    if (updateError) {
                        console.error('[AI Edit API] Error updating history:', updateError)
                    } else {
                        console.log('[AI Edit API] History saved successfully')
                    }

                    // Пишем в глобальный лог только если элемент существует
                    try {
                        const { error: globalLogError } = await supabase.from('ai_correction_logs').insert({
                            news_id: (table === 'news_items') ? validItemId : null,
                            review_id: (table === 'review_items') ? validItemId : null,
                            instruction: instruction || 'No instruction provided',
                            original_text_snippet: safeText.substring(0, 1000),
                            context: table === 'news_items' ? 'editor_news' : 'editor_review'
                        })

                        if (globalLogError) {
                            console.error('[AI Edit API] Error saving global log:', globalLogError)
                        }
                    } catch (logErr) {
                        console.error('[AI Edit API] Critical error in global logging:', logErr)
                    }
                }
            } catch (histError) {
                console.warn("[AI Edit API] Exception in history saving:", histError)
            }
        } else {
            console.warn('[AI Edit API] Skipping history save: invalid itemId', { itemId })
        }

        // 1. Получаем системный промпт из БД
        const { data: promptData } = await supabase
            .from('system_prompts')
            .select('content')
            .eq('key', 'dashboard_edit_text')
            .single();

        let systemPrompt = "Ты — опытный редактор. Твоя задача — переписать текст по инструкции пользователя.";
        if (promptData?.content) {
            systemPrompt = promptData.content;
        }

        const fullPrompt = `${instruction}\n\nОригинальный текст:\n"${text}"`;

        // 2. Готовим API-запрос
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
                { role: 'user', content: fullPrompt }
            ],
            max_tokens: 15000
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
            throw new Error(`Provider Error (${response.status}): ${errText}`);
        }

        const data: any = await response.json();
        const resultText = data.choices?.[0]?.message?.content || "";

        return NextResponse.json({ result: resultText });

    } catch (error: any) {
        console.error("AI Edit Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
