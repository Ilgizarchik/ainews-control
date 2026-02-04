import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { createClient } from '@/lib/supabase/server';

export interface AISettings {
    ai_provider: string;
    ai_model: string;
    ai_base_url: string;
    ai_proxy_url?: string;
    keys: Record<string, string>;
}

const PROVIDER_BASE_URLS: Record<string, string> = {
    'openai': 'https://api.openai.com/v1',
    'anthropic': 'https://api.anthropic.com/v1',
    'openrouter': 'https://openrouter.ai/api/v1',
    'custom': 'http://localhost:11434/v1'
}

export async function getAISettings(): Promise<AISettings> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('project_settings')
        .select('key, value')
        .in('key', [
            'ai_provider', 'ai_model', 'ai_base_url', 'ai_proxy_url',
            'ai_key_openai', 'ai_key_openrouter', 'ai_key_anthropic', 'ai_key_custom',
            'ai_api_key' // Fallback
        ]);

    if (error || !data) {
        throw new Error('Failed to fetch AI settings');
    }

    const map = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {} as any);

    return {
        ai_provider: map.ai_provider || 'openrouter',
        ai_model: map.ai_model || 'gpt-4o-mini',
        ai_base_url: map.ai_base_url || 'https://openrouter.ai/api/v1',
        ai_proxy_url: map.ai_proxy_url,
        keys: {
            openai: map.ai_key_openai || (map.ai_provider === 'openai' ? map.ai_api_key : ''),
            openrouter: map.ai_key_openrouter || (map.ai_provider === 'openrouter' ? map.ai_api_key : ''),
            anthropic: map.ai_key_anthropic || (map.ai_provider === 'anthropic' ? map.ai_api_key : ''),
            custom: map.ai_key_custom || (map.ai_provider === 'custom' ? map.ai_api_key : ''),
            // Generic fallback
            default: map.ai_api_key || ''
        }
    };
}

export type AIConfigOverride = {
    provider?: string | null;
    model?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
}

export async function callAI(systemPrompt: string, userPrompt: string, config?: AIConfigOverride): Promise<string> {
    const settings = await getAISettings();

    // 1. Determine Provider and Model
    let provider = config?.provider || settings.ai_provider;
    // Normalized 'global' to default
    if (provider === 'global') provider = settings.ai_provider;

    const model = config?.model || settings.ai_model;
    const temperature = config?.temperature ?? 0.7;
    const maxTokens = config?.maxTokens ?? 2000;

    // 2. Determine Key
    let apiKey = settings.keys[provider] || settings.keys.default;

    // ... (lines 72-106 remain same, omitted for brevity if tool allows, but here we replace full block for safety or just target lines) ...
    // Since I must replace contiguous block, I will just update the lines around max_completion_tokens

    // ...


    // 3. Determine URL
    // If using the global default provider, respect the custom configured base URL.
    // Otherwise, use the standard URL for that provider.
    let baseUrl = settings.ai_base_url;
    if (provider !== settings.ai_provider && PROVIDER_BASE_URLS[provider]) {
        baseUrl = PROVIDER_BASE_URLS[provider];
    }

    if (!apiKey) {
        throw new Error(`AI API key not configured for provider: ${provider}`);
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://ainews-control.local';
        headers['X-Title'] = 'AiNews Control Center';
    }

    // Anthropic API specific headers if using direct API
    if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01'; // Ensure version
        // Remove Bearer if strictly anthropic direct, but most libs accept standard. 
        // Undici raw fetch needs care. Anthropic uses 'x-api-key' usually.
        // Let's assume standard OpenAI-compatible proxies for now (OpenRouter does this).
        // If direct Anthropic is requested, we might need a different body format.
        // For simplicity in this iteration, we assume OpenAI-compatible formatting (which OpenRouter/vLLM/Ollama use).
        // Direct Anthropic support would require a big switch case for body formatting. 
        // We will stick to OpenAI-compat for now as used by OpenRouter.
    }

    const body = {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_completion_tokens: maxTokens
    };

    const fetchOptions: any = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    };

    if (settings.ai_proxy_url) {
        fetchOptions.dispatcher = new ProxyAgent(settings.ai_proxy_url);
    }

    console.log(`[AI] Calling ${provider} (${model}) at ${baseUrl}...`);

    const response = await undiciFetch(`${baseUrl}/chat/completions`, fetchOptions);

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[AI] Error body: ${errText}`);
        throw new Error(`AI API Error (${provider}): ${response.status} - ${errText.substring(0, 200)}...`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        console.warn('[AI] Empty content received. Raw response:', JSON.stringify(data, null, 2));
    }

    return content || "";
}

export async function generateImage(prompt: string): Promise<string> {
    const settings = await getAISettings();

    // Defaults to OpenRouter logic if provider is openrouter
    // Or Global defaults
    const provider = settings.ai_provider;
    const apiKey = settings.keys[provider] || settings.keys.default;

    if (!apiKey) throw new Error('AI API key not configured');

    if (provider === 'openrouter') {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://ainews-control.local',
            'X-Title': 'AiNews Control Center'
        };

        const body = {
            model: "google/gemini-2.0-flash-exp",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
            image_config: {
                aspect_ratio: "16:9",
                image_size: "1K"
            }
        };

        const fetchOptions: any = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        };

        if (settings.ai_proxy_url) {
            fetchOptions.dispatcher = new ProxyAgent(settings.ai_proxy_url);
        }

        const response = await undiciFetch(`${settings.ai_base_url}/chat/completions`, fetchOptions);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter Image API Error: ${response.status} - ${errText}`);
        }

        const data: any = await response.json();
        const msg = data.choices?.[0]?.message || {};
        const dataUrl = msg.images?.[0]?.image_url?.url || msg.images?.[0]?.imageUrl?.url;

        if (!dataUrl) {
            console.error('OpenRouter Response:', JSON.stringify(data, null, 2));
            throw new Error('No image URL in OpenRouter response');
        }

        return dataUrl;
    }

    // Fallback for OpenAI / DALL-E logic
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    const body = {
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "url"
    };

    const fetchOptions: any = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    };

    if (settings.ai_proxy_url) {
        fetchOptions.dispatcher = new ProxyAgent(settings.ai_proxy_url);
    }

    // Heuristic for Image URL
    let url = 'https://api.openai.com/v1/images/generations';
    if (provider !== 'openai') {
        // Try to construct standard image endpoint from base URL
        url = settings.ai_base_url.replace('/chat/completions', '').replace('/v1', '') + '/v1/images/generations';
    }

    const response = await undiciFetch(url, fetchOptions);

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI Image API Error: ${response.status} - ${errText}`);
    }

    const data: any = await response.json();
    return data.data?.[0]?.url || "";
}
