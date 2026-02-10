import { IPublisher, PublishContext, PublishResult } from './types';
import { ProxyAgent } from 'undici';

export class VkPublisher implements IPublisher {
    private accessToken: string;
    private ownerId: number; // can be negative (group) or positive (user)
    private version = '5.131';
    private proxyUrl?: string;

    constructor(accessToken: string, ownerId: string | number, version?: string, proxyUrl?: string) {
        this.accessToken = accessToken;
        this.ownerId = Number(ownerId);
        if (version) this.version = version;
        this.proxyUrl = proxyUrl;
    }

    async publish(context: PublishContext): Promise<PublishResult> {
        let photoStatus = "нет в контексте";
        try {
            if (!this.accessToken) throw new Error("VK Publish Failed: No Access Token");
            if (!this.ownerId) throw new Error("VK Publish Failed: No Owner ID");

            let attachments: string[] = [];
            const proxyAgent = this.proxyUrl ? new ProxyAgent(this.proxyUrl) : undefined;

            // 1. Upload Image if exists
            if (context.image_url && (context.image_url.startsWith('http') || context.image_url.includes('telegram.org'))) {
                try {
                    const photoAttachment = await this.uploadPhoto(context.image_url, proxyAgent);
                    if (photoAttachment) {
                        attachments.push(photoAttachment);
                        photoStatus = "прикреплено";
                    }
                } catch (e: any) {
                    console.error("[VK] Image upload failed:", e.message);
                    photoStatus = `ошибка: ${e.message}`;
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
            } else if (sourceUrl && attachments.length === 0) {
                message = message + "\n\n" + sourceUrl;
            }

            // Title is already included in generated message (content_html) via AI prompt

            // 3. Post to Wall
            const postId = await this.postToWall(message, attachments, proxyAgent);

            return {
                success: true,
                external_id: String(postId),
                published_url: `https://vk.com/wall${this.ownerId}_${postId}`,
                // @ts-ignore
                photo_status: photoStatus
            };

        } catch (e: any) {
            console.error("VK Publish Error:", e);
            return {
                success: false,
                error: e.message,
                // @ts-ignore
                photo_status: photoStatus
            };
        }
    }

    private async callApi(method: string, params: Record<string, any>, proxyAgent?: any) {
        const url = new URL(`https://api.vk.com/method/${method}`);

        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, String(params[key]));
            }
        });

        url.searchParams.append('access_token', this.accessToken);
        url.searchParams.append('v', this.version);

        const res = await fetch(url.toString(), {
            // @ts-ignore
            dispatcher: proxyAgent,
            // @ts-ignore
            signal: AbortSignal.timeout(30000)
        });
        const json = await res.json();

        if (json.error) {
            throw new Error(`VK API Error [${method}]: ${json.error.error_msg} (code ${json.error.error_code})`);
        }
        return json.response;
    }

    private async uploadPhoto(imageUrl: string, proxyAgent?: any): Promise<string> {
        console.log(`[VK] Starting photo upload for: ${imageUrl}`);
        let groupId = 0;
        if (this.ownerId < 0) {
            groupId = Math.abs(this.ownerId);
        }

        const serverRes = await this.callApi('photos.getWallUploadServer', {
            group_id: groupId || undefined
        }, proxyAgent);

        const uploadUrl = serverRes.upload_url;
        console.log(`[VK] Got upload server: ${uploadUrl}`);

        // B. Download Image (Try without proxy first, as CDN is usually global)
        let imgRes;
        try {
            imgRes = await fetch(imageUrl, {
                // @ts-ignore
                signal: AbortSignal.timeout(15000),
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
        } catch (e) {
            console.log(`[VK] Download without proxy failed, trying with proxy...`);
            imgRes = await fetch(imageUrl, {
                // @ts-ignore
                dispatcher: proxyAgent,
                // @ts-ignore
                signal: AbortSignal.timeout(15000),
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
        }

        if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.statusText}`);

        const blob = await imgRes.blob();
        console.log(`[VK] Downloaded blob: ${blob.size} bytes`);

        const form = new FormData();
        form.append('photo', blob, 'image.jpg');

        // C. Upload (Must use proxy if API is blocked)
        console.log(`[VK] Uploading to VK server...`);
        const uploadPostRes = await fetch(uploadUrl, {
            method: 'POST',
            body: form,
            // @ts-ignore
            dispatcher: proxyAgent,
            // @ts-ignore
            signal: AbortSignal.timeout(30000)
        });
        const uploadData = await uploadPostRes.json();
        console.log(`[VK] Upload data: ${JSON.stringify(uploadData)}`);

        if (!uploadData.photo || uploadData.photo === '[]') {
            throw new Error("VK server rejected the photo (empty photo field in response)");
        }

        // D. Save
        const saveRes = await this.callApi('photos.saveWallPhoto', {
            group_id: groupId || undefined,
            photo: uploadData.photo,
            server: uploadData.server,
            hash: uploadData.hash
        }, proxyAgent);

        if (!saveRes || saveRes.length === 0) {
            throw new Error("Failed to save photo");
        }

        const photo = saveRes[0];
        console.log(`[VK] Photo saved: photo${photo.owner_id}_${photo.id}`);
        return `photo${photo.owner_id}_${photo.id}`;
    }

    private async postToWall(message: string, attachments: string[], proxyAgent?: any) {
        const res = await this.callApi('wall.post', {
            owner_id: this.ownerId,
            from_group: this.ownerId < 0 ? 1 : 0,
            message: message,
            attachments: attachments.join(',')
        }, proxyAgent);
        return res.post_id;
    }
}
