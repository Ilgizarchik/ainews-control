import { IPublisher, PublishContext, PublishResult } from './types';
import { ProxyAgent } from 'undici';

export class FacebookPublisher implements IPublisher {
    private accessToken: string;
    private pageId: string;
    private version = 'v21.0';

    constructor(accessToken: string, pageId: string) {
        this.accessToken = accessToken;
        this.pageId = pageId;
    }

    async publish(context: PublishContext): Promise<PublishResult> {
        try {
            if (!this.accessToken) throw new Error("Facebook Publish Failed: No Access Token");
            if (!this.pageId) throw new Error("Facebook Publish Failed: No Page ID");

            // --- ОБЯЗАТЕЛЬНЫЙ ПРОКСИ ---
            // Сначала берем из конфига, если пусто - берем твой проверенный рабочий прокси
            const configProxy = context.config?.meta_proxy_url || context.config?.twitter_proxy_url;
            const fallbackProxy = "http://gob2rk:tWL00X@45.147.100.186:8000";
            const effectiveProxy = configProxy || fallbackProxy;

            const proxyAgent = new ProxyAgent(effectiveProxy);

            // Очистка текста
            let message = (context.content_html || context.title || '').replace(/<[^>]*>/g, '').trim();
            if (context.title && !message.includes(context.title)) {
                message = `${context.title}\n\n${message}`;
            }

            const plainContent = (context.content_html || '').replace(/<[^>]*>/g, '').trim();
            const lastColonIndex = plainContent.lastIndexOf(':');
            const shouldAttachLink = lastColonIndex !== -1 && /^[:]\s*[\uD800-\uDBFF\uDC00-\uDFFF\s]*$/.test(plainContent.substring(lastColonIndex));
            if (shouldAttachLink && context.source_url && !message.includes(context.source_url)) {
                message += `\n\n${context.source_url}`;
            }

            let endpoint = `https://graph.facebook.com/${this.version}/${this.pageId}/feed`;
            const params: Record<string, any> = {
                message: message,
                access_token: this.accessToken
            };

            if (context.image_url) {
                endpoint = `https://graph.facebook.com/${this.version}/${this.pageId}/photos`;
                params.url = context.image_url;
                params.caption = message;
                delete params.message;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
                // @ts-ignore
                dispatcher: proxyAgent,
                // @ts-ignore
                signal: AbortSignal.timeout(40000)
            });

            const json = await res.json();

            if (json.error) {
                throw new Error(`Facebook API Error: ${json.error.message}`);
            }

            return {
                success: true,
                external_id: String(json.id || json.post_id),
                published_url: `https://facebook.com/${json.id || json.post_id}`
            };

        } catch (e: any) {
            console.error("Facebook Publish Error Detail:", e);
            return { success: false, error: `Facebook Error: ${e.message}` };
        }
    }
}
