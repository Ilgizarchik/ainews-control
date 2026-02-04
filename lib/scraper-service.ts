import { fetch as undiciFetch } from 'undici';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function scrapeArticleText(url: string, selector?: string): Promise<string> {
    try {
        const response = await undiciFetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch article: ${response.statusText}`);
        }

        const html = await response.text();
        const doc = new JSDOM(html, { url });
        const document = doc.window.document;

        let text = '';

        // 1. If we have a specific selector, try it first
        if (selector) {
            console.log(`[Scraper] Using custom selector: ${selector}`);
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
        console.error('Scraping error:', error);
        throw error; // Re-throw to be handled by the caller
    }
}
