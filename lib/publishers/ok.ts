import { IPublisher, PublishContext, PublishResult } from './types';
import { createHash } from 'crypto';
import { ProxyAgent } from 'undici';

export class OkPublisher implements IPublisher {
    private accessToken: string;
    private applicationKey: string;
    private appSecret: string;
    private groupId: string;
    private proxyUrl?: string;

    constructor(accessToken: string, applicationKey: string, appSecret: string, groupId: string, proxyUrl?: string) {
        this.accessToken = accessToken;
        this.applicationKey = applicationKey;
        this.appSecret = appSecret;
        this.groupId = groupId;
        this.proxyUrl = proxyUrl;
    }

    private md5(str: string): string {
        return createHash('md5').update(str).digest('hex');
    }

    private getSessionSecret(): string {
        return this.appSecret;
    }

    private generateSignature(params: Record<string, string>): string {
        const sortedKeys = Object.keys(params).sort();
        let sigSource = '';
        for (const key of sortedKeys) {
            sigSource += `${key}=${params[key]}`;
        }
        sigSource += this.getSessionSecret();
        return this.md5(sigSource);
    }

    async publish(context: PublishContext): Promise<PublishResult> {
        try {
            let photoToken: string | null = null;
            const proxyAgent = this.proxyUrl ? new ProxyAgent(this.proxyUrl) : undefined;

            // 1. Upload Photo if exists
            if (context.image_url && context.image_url.startsWith('http')) {
                try {
                    photoToken = await this.uploadPhoto(context.image_url, proxyAgent);
                } catch (e: any) {
                    console.error("[OK] Photo upload failed:", e.message);
                }
            }

            // 2. Prepare Message
            let message = (context.content_html || context.title || '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>|<\/div>/gi, '\n')
                .replace(/<li>/gi, '\n- ')
                .replace(/<[^>]*>/g, '')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n\s*\n/g, '\n\n')
                .trim();
            const sourceUrl = context.source_url || '';

            if (message.includes('[LINK]')) {
                message = message.replace(/\[LINK\]/gi, sourceUrl);
            }

            // Title is already included in generated message (content_html) via AI prompt

            // 3. Prepare Attachment JSON
            const mediaList: any[] = [
                {
                    "type": "text",
                    "text": message
                }
            ];

            if (photoToken) {
                mediaList.push({
                    "type": "photo",
                    "list": [{ "id": photoToken }]
                });
            }

            const attachment = JSON.stringify({ "media": mediaList });

            // 4. Post to Group
            const params: Record<string, string> = {
                "application_key": this.applicationKey,
                "attachment": attachment,
                "format": "json",
                "gid": this.groupId,
                "method": "mediatopic.post",
                "session_key": this.accessToken,
                "type": "GROUP_THEME"
            };

            const sig = this.generateSignature(params);

            const url = new URL('https://api.ok.ru/fb.do');
            Object.entries(params).forEach(([key, val]) => url.searchParams.append(key, val));
            url.searchParams.append('sig', sig);

            const res = await fetch(url.toString(), {
                method: 'POST',
                // @ts-ignore
                dispatcher: proxyAgent,
                // @ts-ignore
                signal: AbortSignal.timeout(30000)
            });
            const json = await res.json();

            if (json.error_code) {
                throw new Error(`OK API Error: ${json.error_msg} (code ${json.error_code})`);
            }

            return {
                success: true,
                external_id: String(json),
                published_url: `https://ok.ru/group/${this.groupId}/topic/${json}`
            };

        } catch (e: any) {
            console.error("OK Publish Error:", e);
            return { success: false, error: e.message };
        }
    }

    private async uploadPhoto(imageUrl: string, proxyAgent?: any): Promise<string> {
        console.log(`[OK] Starting photo upload for: ${imageUrl}`);
        // A. Get Upload URL
        const params: Record<string, string> = {
            "application_key": this.applicationKey,
            "format": "json",
            "gid": this.groupId,
            "method": "photosV2.getUploadUrl",
            "count": "1",
            "session_key": this.accessToken
        };
        const sig = this.generateSignature(params);

        const url = new URL('https://api.ok.ru/fb.do');
        Object.entries(params).forEach(([key, val]) => url.searchParams.append(key, val));
        url.searchParams.append('sig', sig);

        const serverRes = await fetch(url.toString(), {
            // @ts-ignore
            dispatcher: proxyAgent,
            // @ts-ignore
            signal: AbortSignal.timeout(30000)
        });
        const serverData = await serverRes.json();

        if (!serverData.upload_url) {
            throw new Error("Failed to get OK upload URL: " + JSON.stringify(serverData));
        }

        const uploadUrl = serverData.upload_url;
        const photoId = serverData.photo_ids[0];
        console.log(`[OK] Got upload URL: ${uploadUrl}`);

        // B. Download Image (Try without proxy first, as CDN is usually global)
        let imgRes;
        try {
            imgRes = await fetch(imageUrl, {
                // @ts-ignore
                signal: AbortSignal.timeout(15000),
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
        } catch (e) {
            console.log(`[OK] Download without proxy failed, trying with proxy...`);
            imgRes = await fetch(imageUrl, {
                // @ts-ignore
                dispatcher: proxyAgent,
                // @ts-ignore
                signal: AbortSignal.timeout(15000),
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
        }

        if (!imgRes.ok) throw new Error(`Failed to download image for OK: ${imgRes.statusText}`);

        const blob = await imgRes.blob();
        console.log(`[OK] Downloaded blob: ${blob.size} bytes`);

        const form = new FormData();
        form.append('pic1', blob, 'image.jpg');

        // C. Upload
        console.log(`[OK] Uploading to OK server...`);
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            body: form,
            // @ts-ignore
            dispatcher: proxyAgent,
            // @ts-ignore
            signal: AbortSignal.timeout(30000)
        });
        const uploadData = await uploadRes.json();
        console.log(`[OK] Upload result: ${JSON.stringify(uploadData)}`);

        // D. Commit (optional in some APIs, but often needed)
        // For photosV2.getUploadUrl, the result of POST is already the tokens we need.
        if (!uploadData.photos || !uploadData.photos[photoId] || !uploadData.photos[photoId].token) {
            throw new Error(`OK Upload failed: ${JSON.stringify(uploadData)}`);
        }
        const token = uploadData.photos[photoId].token;
        console.log(`[OK] Photo token received: ${token}`);
        return token;
    }
}
