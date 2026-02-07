import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { createClient } from '@/lib/supabase/server';

// Helper to get proxy configuration
async function getProxyConfig(): Promise<{ url: string; enabled: boolean } | null> {
    try {
        const supabase = await createClient();
        const { data } = await supabase
            .from('project_settings')
            .select('key, value')
            .eq('project_key', 'ainews')
            .in('key', ['ai_proxy_url', 'ai_proxy_enabled']);

        if (!data) return null;

        const proxyUrl = data.find(r => r.key === 'ai_proxy_url')?.value;
        const proxyEnabled = data.find(r => r.key === 'ai_proxy_enabled')?.value === 'true';

        if (proxyEnabled && proxyUrl) {
            return { url: proxyUrl, enabled: true };
        }
    } catch (e) {
        console.warn('[Scraper] Failed to fetch proxy config:', e);
    }
    return null;
}

export async function scrapeArticleText(url: string, selector?: string): Promise<string> {
    try {
        // Get proxy configuration
        const proxyConfig = await getProxyConfig();

        const fetchOptions: any = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        // Add proxy if enabled
        if (proxyConfig?.enabled && proxyConfig?.url) {
            fetchOptions.dispatcher = new ProxyAgent(proxyConfig.url);
        }

        const response = await undiciFetch(url, fetchOptions);

        if (!response.ok) {
            throw new Error(`Failed to fetch article: ${response.statusText}`);
        }

        const html = await response.text();
        const doc = new JSDOM(html, { url });
        const document = doc.window.document;

        let text = '';

        // 1. If we have a specific selector, try it first
        if (selector) {
            const target = document.querySelector(selector);
            if (target) {
                // Focus only on the target element
                text = target.textContent || '';
            }
        }

        // 2. Fallback to Readability
        if (!text || text.trim().length === 0) {
            const reader = new Readability(document);
            const article = reader.parse();
            text = article?.textContent || '';
        }

        // 3. Last resort: blind HTML stripping
        if (!text || text.trim().length === 0) {
            text = html
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        // Clean up whitespace (newlines to spaces, multiple spaces to one)
        text = text.replace(/\s+/g, ' ').trim();

        // Truncate to avoid token limits
        return text.substring(0, 15000);
    } catch (error) {
        console.error('[Scraper] Error:', error);
        throw error; // Re-throw to be handled by the caller
    }
}
