import { NextResponse } from 'next/server';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

export async function POST(req: Request) {
    try {
        const { baseUrl, apiKey, provider, proxyUrl } = await req.json();

        if (!baseUrl) {
            return NextResponse.json({ error: 'Missing baseUrl' }, { status: 400 });
        }

        // Adjust endpoint based on provider standards
        const cleanBaseUrl = baseUrl.replace(/\/$/, "");
        const endpoint = `${cleanBaseUrl}/models`;

        console.log(`[AI Proxy] Fetching models from: ${endpoint}`);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; AiNewsControl/1.0; +https://ainews.control)'
        };

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;

            // OpenRouter specific
            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = 'https://ainews-control.local';
                headers['X-Title'] = 'AiNews Control';
            }
        }

        const fetchOptions: any = {
            method: 'GET',
            headers: headers
        };

        if (proxyUrl) {
            console.log(`[AI Proxy] Using Proxy: ${proxyUrl}`);
            try {
                fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
            } catch (e: any) {
                console.error('[AI Proxy] Failed to initialize ProxyAgent:', e);
                return NextResponse.json(
                    { error: 'Invalid Proxy URL', details: e.message },
                    { status: 400 }
                );
            }
        }

        // Use undici fetch explicitly to ensure ProxyAgent is respected
        const response = await undiciFetch(endpoint, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Proxy] External API Error (${response.status}):`, errorText);

            let errorJson;
            try {
                errorJson = JSON.parse(errorText);
            } catch (e) {
                errorJson = { details: errorText };
            }

            return NextResponse.json(
                { error: `Provider returned ${response.status}`, details: errorJson },
                { status: response.status }
            );
        }

        const data: any = await response.json();

        // Debug logging
        if (data.data && Array.isArray(data.data)) {
            console.log(`[AI Proxy] Provider returned ${data.data.length} models.`);
        } else if (Array.isArray(data)) {
            console.log(`[AI Proxy] Provider returned ${data.length} models (array).`);
        } else {
            console.log(`[AI Proxy] Provider returned non-array structure. Keys: ${Object.keys(data).join(', ')}`);
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('[AI Proxy] Internal Error:', error);
        return NextResponse.json(
            { error: 'Internal Proxy Error', details: error.message },
            { status: 500 }
        );
    }
}
