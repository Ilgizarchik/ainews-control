import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { createClient } from '@/lib/supabase/server';
import { logErrorToTelegram } from './logger-service';

export interface AISettings {
    ai_provider: string;
    ai_model: string;
    ai_base_url: string;
    ai_proxy_url?: string;
    ai_proxy_enabled?: boolean;
    ai_image_provider?: string;
    ai_image_model?: string;
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
        .eq('project_key', 'ainews')
        .in('key', [
            'ai_provider', 'ai_model', 'ai_base_url', 'ai_proxy_url', 'ai_proxy_enabled',
            'ai_image_provider', 'ai_image_model',
            'ai_key_openai', 'ai_key_openrouter', 'ai_key_anthropic', 'ai_key_custom',
            'ai_api_key' // Fallback
        ]);

    console.log('[getAISettings] Query result:', { error, dataLength: data?.length });

    // If DB connection fails, use env vars as fallback
    if (error) {
        console.error('[getAISettings] Supabase error, using ENV fallback:', error);
        const envProvider = process.env.AI_PROVIDER || 'openrouter';
        return {
            ai_provider: envProvider,
            ai_model: process.env.AI_MODEL || 'anthropic/claude-3.5-sonnet',
            ai_base_url: process.env.AI_BASE_URL || PROVIDER_BASE_URLS[envProvider as keyof typeof PROVIDER_BASE_URLS] || 'https://openrouter.ai/api/v1',
            ai_proxy_url: process.env.AI_PROXY_URL,
            ai_proxy_enabled: process.env.AI_PROXY_ENABLED === 'true',
            ai_image_provider: process.env.AI_IMAGE_PROVIDER,
            ai_image_model: process.env.AI_IMAGE_MODEL,
            keys: {
                openai: process.env.AI_KEY_OPENAI || '',
                openrouter: process.env.AI_KEY_OPENROUTER || '',
                anthropic: process.env.AI_KEY_ANTHROPIC || '',
                custom: process.env.AI_KEY_CUSTOM || '',
                default: process.env.AI_API_KEY || ''
            }
        };
    }

    if (!data || data.length === 0) {
        console.error('[getAISettings] No data returned from project_settings');
        throw new Error('No AI settings found in database');
    }

    const map = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {} as any);

    return {
        ai_provider: map.ai_provider || 'openrouter',
        ai_model: map.ai_model || 'gpt-4o-mini',
        ai_base_url: map.ai_base_url || 'https://openrouter.ai/api/v1',
        ai_proxy_url: map.ai_proxy_url,
        ai_proxy_enabled: map.ai_proxy_enabled === 'true',
        ai_image_provider: map.ai_image_provider,
        ai_image_model: map.ai_image_model,
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
    responseFormat?: any;
}

export async function callAI(systemPrompt: string, userPrompt: string, config?: AIConfigOverride): Promise<string> {
    const settings = await getAISettings();

    // 1. Determine Provider and Model
    let provider = config?.provider || settings.ai_provider;
    // Normalized 'global' to default
    if (provider === 'global') provider = settings.ai_provider;

    const model = config?.model || settings.ai_model;
    const temperature = config?.temperature ?? 0.7;
    const maxTokens = config?.maxTokens ?? 4000;

    // 2. Determine Key
    let apiKey = settings.keys[provider] || settings.keys.default;

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
    }

    const body: any = {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: maxTokens
    };

    if (config?.responseFormat) {
        body.response_format = config.responseFormat;
    }

    // Некоторые модели (например, Gemini 2.5 Flash Image) не поддерживают temperature
    if (!model.includes('image') && !model.includes('flash')) {
        body.temperature = temperature;
    }

    const fetchOptions: any = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000) // 60 second timeout
    };

    if (settings.ai_proxy_url && settings.ai_proxy_enabled) {
        try {
            fetchOptions.dispatcher = new ProxyAgent(settings.ai_proxy_url);
            console.log(`[AI] Using Proxy: ${settings.ai_proxy_url}`);
        } catch (e) {
            console.error('[AI] Invalid Proxy URL or Agent creation failed:', e);
        }
    } else {
        console.log(`[AI] Direct connection (Enabled: ${settings.ai_proxy_enabled}, URL: ${settings.ai_proxy_url})`);
    }

    try {
        const response = await undiciFetch(`${baseUrl}/chat/completions`, fetchOptions);

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[AI] Error body: ${errText}`);
            const errorMsg = `AI API Error (${provider}): ${response.status} - ${errText.substring(0, 200)}...`;
            await logErrorToTelegram(errorMsg, `callAI (${model})`);
            throw new Error(errorMsg);
        }

        const data: any = await response.json();
        const choice = data.choices?.[0];
        const content = choice?.message?.content;
        const finishReason = choice?.finish_reason;
        const usage = data.usage;

        console.log(`[AI] Response: model=${data.model}, finish_reason=${finishReason}, usage=${JSON.stringify(usage)}`);

        if (finishReason === 'length') {
            const msg = `AI generation truncated (max tokens hit). Usage: ${JSON.stringify(usage)}. Please simplify prompt or increase limit.`;
            console.warn(`[AI] ${msg}`);
            // Throwing error so UI shows the problem instead of partial text
            throw new Error(msg);
        }

        if (!content) {
            console.warn('[AI] Empty content received. Raw response:', JSON.stringify(data, null, 2));
        }

        return content || "";
    } catch (error: any) {
        const isProxyError = settings.ai_proxy_enabled && settings.ai_proxy_url;
        const proxyMsg = isProxyError ? " (Check Proxy Settings)" : "";

        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            // ...
            // preserve existing error handling
            const timeoutMsg = `AI request timeout (${provider}/${model}) after 60 seconds${proxyMsg}`;
            console.error(`[AI] ${timeoutMsg}`);
            await logErrorToTelegram(timeoutMsg, `callAI (${model})`);
            throw new Error(timeoutMsg);
        }

        // Re-throw our new specific error
        if (error.message.includes('AI generation hit max_tokens')) throw error;

        // Enhance connection errors
        if (error.cause?.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            console.error(`[AI] Connection Reset${proxyMsg}. If you are in a restricted region, ensure Proxy is ENABLED and WORKING.`);
        }

        throw error; // Re-throw other errors
    }
}

export async function generateImage(prompt: string): Promise<string> {
    const settings = await getAISettings();

    // Determine specific image provider and model
    const provider = (settings.ai_image_provider && settings.ai_image_provider !== 'global')
        ? settings.ai_image_provider
        : settings.ai_provider;

    const model = settings.ai_image_model ||
        (provider === 'openrouter' ? "google/gemini-2.5-flash-image" : "dall-e-3");

    const apiKey = settings.keys[provider] || settings.keys.default;

    if (!apiKey) throw new Error(`AI API key not configured for provider: ${provider}`);

    if (provider === 'openrouter') {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://ainews-control.local',
            'X-Title': 'AiNews Control Center'
        };

        const body = {
            model: model,
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
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(90000) // 90 second timeout for image generation
        };

        if (settings.ai_proxy_url && settings.ai_proxy_enabled) {
            try {
                fetchOptions.dispatcher = new ProxyAgent(settings.ai_proxy_url);
                console.log(`[AI Image] Using Proxy: ${settings.ai_proxy_url}`);
            } catch (e) {
                console.error('[AI Image] Invalid Proxy URL:', e);
            }
        }

        const response = await undiciFetch(`${settings.ai_base_url}/chat/completions`, fetchOptions);

        if (!response.ok) {
            const errText = await response.text();
            const errorMsg = `OpenRouter Image API Error: ${response.status} - ${errText}`;
            await logErrorToTelegram(errorMsg, `generateImage (${body.model})`);
            throw new Error(errorMsg);
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
        model: model,
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

    if (settings.ai_proxy_url && settings.ai_proxy_enabled) {
        try {
            fetchOptions.dispatcher = new ProxyAgent(settings.ai_proxy_url);
            console.log(`[AI Image] Using Proxy: ${settings.ai_proxy_url}`);
        } catch (e) {
            console.error('[AI Image] Invalid Proxy URL:', e);
        }
    }

    // Heuristic for Image URL
    let url = 'https://api.openai.com/v1/images/generations';
    if (provider !== 'openai') {
        // Try to construct standard image endpoint from base URL
        // If the user provided a custom base URL expecting standard OpenAI /images/generations support
        url = settings.ai_base_url.replace('/chat/completions', '').replace(/\/v\d+$/, '') + '/v1/images/generations';
    }

    const response = await undiciFetch(url, fetchOptions);

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI Image API Error: ${response.status} - ${errText}`);
    }

    const data: any = await response.json();
    return data.data?.[0]?.url || "";
}
