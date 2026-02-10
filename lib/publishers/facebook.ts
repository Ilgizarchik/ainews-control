import { IPublisher, PublishContext, PublishResult } from './types';
import { ProxyAgent } from 'undici';

export class FacebookPublisher implements IPublisher {
    private accessToken: string;
    private pageId: string;
    private version = 'v22.0';

    constructor(accessToken: string, pageId: string) {
        this.accessToken = (accessToken || '').trim();
        this.pageId = (pageId || '').trim().replace(/^id/i, '');
    }

    async publish(context: PublishContext): Promise<PublishResult> {
        try {
            if (!this.accessToken) throw new Error("No Access Token");
            if (!this.pageId) throw new Error("No Page ID");

            // --- ПРОКСИ ---
            const aiProxyUrl = context.config?.ai_proxy_url;
            const aiProxyEnabled = context.config?.ai_proxy_enabled;
            const fallbackProxy = "http://gob2rk:tWL00X@45.147.100.186:8000";
            let proxyAgent = undefined;
            const effectiveProxy = (aiProxyEnabled && aiProxyUrl) ? aiProxyUrl : fallbackProxy;
            if (effectiveProxy && (effectiveProxy.startsWith('http://') || effectiveProxy.startsWith('https://'))) {
                proxyAgent = new ProxyAgent(effectiveProxy);
            }

            // --- ТЕКСТ ---
            let message = (context.content_html || context.title || '')
                .replace(/<[^>]*>/g, '')
                .replace(/\[\/?(b|i|u|s|url|code|quote|size|color)[^\]]*\]/gi, '')
                .trim();

            const sourceUrl = context.source_url || '';
            if (message.includes('[LINK]')) {
                message = message.replace(/\[LINK\]/gi, sourceUrl);
            }

            if (context.title && !message.includes(context.title)) {
                message = `${context.title}\n\n${message}`;
            }

            // Формируем URL с токеном прямо в нем — это самый надежный способ для FB
            let endpoint = `https://graph.facebook.com/${this.version}/${this.pageId}/feed?access_token=${this.accessToken}`;
            const body: Record<string, any> = { message };

            if (context.image_url && context.image_url.startsWith('http')) {
                endpoint = `https://graph.facebook.com/${this.version}/${this.pageId}/photos?access_token=${this.accessToken}`;
                body.url = context.image_url;
                body.caption = message;
                delete body.message;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                // @ts-ignore
                dispatcher: proxyAgent,
                // @ts-ignore
                signal: AbortSignal.timeout(60000)
            });

            const json = await res.json();

            if (json.error) {
                // Если ошибка все еще про deprecated, значит FB не верит, что это Page Token
                throw new Error(json.error.message);
            }

            const id = json.id || json.post_id;
            return {
                success: true,
                external_id: String(id),
                published_url: `https://facebook.com/${id}`
            };

        } catch (e: any) {
            console.error("FB Error:", e.message);
            return { success: false, error: `Facebook Error: ${e.message}` };
        }
    }
}
