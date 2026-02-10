import { IPublisher, PublishContext, PublishResult } from './types';
import { ProxyAgent } from 'undici';

interface ThreadsSettings {
    th_access_token?: string;
    th_user_id?: string;
    [key: string]: any;
}

export class ThreadsPublisher implements IPublisher {
    private accessToken?: string;
    private userId?: string;

    constructor(accessToken?: string, userId?: string) {
        this.accessToken = accessToken;
        this.userId = userId;
    }

    async create(settings: ThreadsSettings): Promise<this> {
        this.accessToken = settings.th_access_token;
        this.userId = settings.th_user_id;
        return this;
    }

    private stripHtml(html: string): string {
        if (!html) return '';
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>|<\/div>/gi, '\n')
            .replace(/<li>/gi, '\n- ')
            .replace(/<[^>]*>/g, '')
            .replace(/[ \t]+/g, ' ') // Collapse multiple spaces but NOT newlines
            .replace(/\n\s*\n/g, '\n\n') // Collapse multiple newlines
            .trim();
    }

    async publish(job: PublishContext, settings?: ThreadsSettings): Promise<PublishResult> {
        const token = settings?.th_access_token || this.accessToken;
        let uId = settings?.th_user_id || this.userId;

        if (!token) return { success: false, error: 'Threads Error: Access token missing.' };

        try {
            const aiProxyUrl = job.config?.ai_proxy_url;
            const aiProxyEnabled = job.config?.ai_proxy_enabled;
            let proxyAgent = undefined;
            if (aiProxyEnabled && aiProxyUrl && (aiProxyUrl.startsWith("http://") || aiProxyUrl.startsWith("https://"))) {
                proxyAgent = new ProxyAgent(aiProxyUrl);
            }

            // 1. Resolve User ID
            if (!uId) {
                const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id&access_token=${token}`, {
                    // @ts-ignore
                    dispatcher: proxyAgent,
                    // @ts-ignore
                    signal: AbortSignal.timeout(15000)
                });
                const meData = await meRes.json();
                uId = meData.id;
            }

            const rawContent = job.content_html || (job as any).text || '';
            let text = this.stripHtml(rawContent);
            const sourceUrl = job.source_url || '';

            if (text.includes('[LINK]')) {
                text = text.replace(/\[LINK\]/gi, job.source_url || '');
            }

            const imageUrl = job.image_url;
            const hasImage = !!imageUrl && imageUrl.startsWith('http');

            // ПОПЫТКА 1: С КАРТИНКОЙ (если есть)
            if (hasImage) {
                try {
                    return await this.executePublish(uId!, token, 'IMAGE', text, proxyAgent, imageUrl);
                } catch (imgErr: any) {
                    console.warn(`[Threads] Image publication failed: ${imgErr.message}. Falling back to TEXT mode...`);
                }
            }

            // ПОПЫТКА 2: ТОЛЬКО ТЕКСТ (Fallback или если картинки нет)
            return await this.executePublish(uId!, token, 'TEXT', text, proxyAgent);

        } catch (error: any) {
            console.error('[Threads] Critical Failure:', error.message);
            return { success: false, error: `Threads Error: ${error.message}` };
        }
    }

    private async executePublish(userId: string, token: string, mode: 'IMAGE' | 'TEXT', text: string, proxyAgent?: ProxyAgent, imageUrl?: string): Promise<PublishResult> {
        const containerPayload: any = {
            media_type: mode,
            text: text,
            access_token: token
        };
        if (mode === 'IMAGE') containerPayload.image_url = imageUrl;

        const containerRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(containerPayload),
            // @ts-ignore
            dispatcher: proxyAgent,
            // @ts-ignore
            signal: AbortSignal.timeout(30000)
        });

        const containerData = await containerRes.json();
        if (!containerData.id) {
            throw new Error(containerData.error?.message || 'Container creation failed');
        }

        const creationId = containerData.id;

        if (mode === 'IMAGE') {
            await new Promise(r => setTimeout(r, 6000));
        } else {
            await new Promise(r => setTimeout(r, 1000));
        }

        const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: creationId, access_token: token }),
            // @ts-ignore
            dispatcher: proxyAgent,
            // @ts-ignore
            signal: AbortSignal.timeout(30000)
        });

        const publishData = await publishRes.json();
        if (!publishData.id) {
            throw new Error(publishData.error?.message || 'Publication failed');
        }

        return {
            success: true,
            external_id: publishData.id,
            published_url: `https://www.threads.net/t/${publishData.id}`
        };
    }
}
