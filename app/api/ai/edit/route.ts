import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

export async function POST(req: Request) {
    const supabase = await createClient();
    try {
        const { text, instruction, apiKey, baseUrl, model, provider, proxyUrl } = await req.json();

        // 1. Fetch System Prompt from DB
        const { data: promptData, error: promptError } = await supabase
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
