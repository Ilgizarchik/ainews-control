'use server'

import { getAISettings } from '@/lib/ai-service'

const PROVIDER_URLS: Record<string, string> = {
    'openai': 'https://api.openai.com/v1',
    'anthropic': 'https://api.anthropic.com/v1',
    'openrouter': 'https://openrouter.ai/api/v1',
    'custom': 'http://localhost:11434/v1' // Default custom, usually overridden
}

export async function getModelsForProvider(provider: string) {
    if (provider === 'global') return []

    // 1. Get settings securely serverside
    const settings = await getAISettings()
    const apiKey = settings.keys[provider] || settings.keys.default

    // Determine Base URL
    let baseUrl = settings.ai_base_url
    if (provider !== settings.ai_provider && PROVIDER_URLS[provider]) {
        baseUrl = PROVIDER_URLS[provider]
    }
    // If provider is OpenRouter, force standard URL if base is weird
    if (provider === 'openrouter' && !baseUrl.includes('openrouter')) {
        baseUrl = 'https://openrouter.ai/api/v1'
    }

    if (!apiKey && provider !== 'custom') {
        // Return empty or error? Empty is safer for UI.
        return []
    }

    // 2. Call the existing internal API if I want to reuse valid proxy logic?
    // Actually, calling the deployed API route (localhost:3000/api/ai/models) from Server Action is weird.
    // Better to replicate logic or import logic.
    // Since `api/ai/models` uses `undici` and handles proxies, let's reuse simpler version here or call the external API directly.
    // I'll reuse the logic from `api/ai/models/route.ts` but implemented as a function here to avoid self-fetch loop issues.

    try {
        const { fetch: undiciFetch, ProxyAgent } = await import('undici')

        const cleanBaseUrl = baseUrl.replace(/\/$/, "")
        const endpoint = `${cleanBaseUrl}/models`

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://ainews-control.local',
            'X-Title': 'AiNews Control'
        }

        const fetchOptions: any = {
            method: 'GET',
            headers: headers
        }

        if (settings.ai_proxy_url) {
            try {
                fetchOptions.dispatcher = new ProxyAgent(settings.ai_proxy_url)
            } catch (e) {
                console.error('Proxy init failed', e)
            }
        }

        const response = await undiciFetch(endpoint, fetchOptions)

        if (!response.ok) {
            console.error(`Fetch failed: ${response.status}`)
            return []
        }

        const data: any = await response.json()
        let models: string[] = []

        if (data.data && Array.isArray(data.data)) {
            models = data.data.map((m: any) => m.id || m.model_name || m.name)
        } else if (Array.isArray(data)) {
            models = data.map((m: any) => typeof m === 'string' ? m : (m.id || m.name))
        } else if (data.models && Array.isArray(data.models)) {
            models = data.models.map((m: any) => m.id || m.name)
        }

        return models.filter(Boolean).sort()

    } catch (e) {
        console.error('Get Models Error:', e)
        return []
    }
}
