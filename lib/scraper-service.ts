import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { createClient } from '@/lib/supabase/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

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
    const proxyConfig = await getProxyConfig();

    // Пытаемся использовать Python Bridge для обхода защиты (Cloudflare и т.д.)
    try {
        console.log(`[Scraper] Attempting Python Bridge for: ${url}`);
        const bridgePath = path.join(process.cwd(), 'scraper_bridge.py');
        let cmd = `python "${bridgePath}" --url "${url}"`;
        if (proxyConfig?.enabled && proxyConfig?.url) {
            cmd += ` --proxy "${proxyConfig.url}"`;
        }

        const { stdout } = await execPromise(cmd, { timeout: 45000 });
        const result = JSON.parse(stdout);

        if (result.success && result.content && result.content.length > 500) {
            console.log(`[Scraper] Python Bridge success! Length: ${result.content.length}`);
            return result.content;
        }
        console.warn(`[Scraper] Python Bridge returned insufficient content, falling back to Node.js...`);
    } catch (bridgeError) {
        console.error(`[Scraper] Python Bridge failed:`, bridgeError);
    }

    // --- FALLBACK TO NODE.JS (Native fetch) ---
    try {
        const fetchOptions: any = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        };

        if (proxyConfig?.enabled && proxyConfig?.url) {
            fetchOptions.dispatcher = new ProxyAgent(proxyConfig.url);
        }

        const response = await undiciFetch(url, fetchOptions);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const doc = new JSDOM(html, { url });
        const document = doc.window.document;

        let text = '';
        if (selector) {
            const target = document.querySelector(selector);
            if (target) text = target.textContent || '';
        }

        if (!text || text.trim().length < 300) {
            try {
                const reader = new Readability(document);
                const article = reader.parse();
                if (article?.textContent) text = article.textContent;
            } catch (readError) {
                console.warn('[Scraper] Readability failed:', readError);
            }
        }

        if (!text || text.trim().length < 300) {
            const rawBody = document.body?.textContent || html;
            text = rawBody.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "").replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }

        text = text.replace(/\s+/g, ' ').trim();
        return text.substring(0, 15000);
    } catch (error) {
        console.error('[Scraper] Node.js Fallback Error:', error);
        throw error;
    }
}
