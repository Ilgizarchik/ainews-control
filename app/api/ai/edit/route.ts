import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

export async function POST(req: Request) {
    const supabase = await createClient();
    try {
        const { text, instruction, apiKey, baseUrl, model, provider, proxyUrl, itemId, itemType } = await req.json();

        // 0. Save Correction History
        // Helper to validate UUID format
        const isUUID = (str: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

        const validItemId = itemId && isUUID(itemId) ? itemId : null;

        if (validItemId && itemType) {
            const table = itemType === 'news' ? 'news_items' : 'review_items'
            try {
                // Fetch current history
                const { data: current, error: fetchError } = await supabase
                    .from(table)
                    .select('correction_history')
                    .eq('id', validItemId)
                    .single()

                if (fetchError) {
                    console.error('[AI Edit API] Error fetching history:', fetchError)
                }

                const history = Array.isArray(current?.correction_history)
                    ? current.correction_history
                    : []

                // Append new instruction
                history.push({
                    date: new Date().toISOString(),
                    instruction,
                    original_text_snippet: text.substring(0, 100) + (text.length > 100 ? '...' : '')
                })

                // Update item history
                const { error: updateError } = await supabase
                    .from(table)
                    .update({ correction_history: history })
                    .eq('id', validItemId)

                if (updateError) {
                    console.error('[AI Edit API] Error updating history:', updateError)
                }
            } catch (histError) {
                console.warn("[AI Edit API] Exception in history saving:", histError)
            }
        }

        // ALWAYS Log to dedicated table for global history (even if no associated item)
        try {
            const { error: globalLogError } = await supabase.from('ai_correction_logs').insert({
                news_id: (itemType === 'news' && validItemId) ? validItemId : null,
                review_id: (itemType === 'review' && validItemId) ? validItemId : null,
                instruction: instruction || 'No instruction provided',
                original_text_snippet: text?.substring(0, 1000) || '',
                context: itemType ? `editor_${itemType}` : 'general_editor'
            })

            if (globalLogError) {
                console.error('[AI Edit API] Error saving global log:', globalLogError)
            }
        } catch (logErr) {
            console.error('[AI Edit API] Critical error in global logging:', logErr)
        }

        // 1. Fetch System Prompt from DB
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

        // 2. Prepare API Call
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
            ]
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
