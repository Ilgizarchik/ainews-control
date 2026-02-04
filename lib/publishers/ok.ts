import { IPublisher, PublishContext, PublishResult } from './types';
import { createHash } from 'crypto';

export class OkPublisher implements IPublisher {
    private accessToken: string;
    private applicationKey: string;
    private appSecret: string;
    private groupId: string;

    constructor(accessToken: string, applicationKey: string, appSecret: string, groupId: string) {
        this.accessToken = accessToken;
        this.applicationKey = applicationKey;
        this.appSecret = appSecret;
        this.groupId = groupId;
    }

    private md5(str: string): string {
        return createHash('md5').update(str).digest('hex');
    }

    private getSessionSecret(): string {
        return this.md5(this.accessToken + this.appSecret);
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

            // 1. Upload Photo if exists
            if (context.image_url) {
                try {
                    photoToken = await this.uploadPhoto(context.image_url);
                } catch (e) {
                    console.error("[OK] Photo upload failed, proceeding with text only", e);
                }
            }

            // 2. Prepare Message
            let message = context.content_html || context.title;
            // Strip HTML tags for OK
            message = message.replace(/<[^>]*>/g, '').trim();

            if (context.title && !message.includes(context.title)) {
                message = `${context.title}\n\n${message}`;
            }

            const plainContentForLink = (context.content_html || '').replace(/<[^>]*>/g, '').trim();
            const lastColonIndex = plainContentForLink.lastIndexOf(':');
            const shouldAttachLink = lastColonIndex !== -1 && /^[:]\s*[\uD800-\uDBFF\uDC00-\uDFFF\s]*$/.test(plainContentForLink.substring(lastColonIndex));

            if (shouldAttachLink && context.source_url && !message.includes(context.source_url)) {
                message += `\n\n${context.source_url}`;
            }

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
                "type": "GROUP_THEME"
            };

            const sig = this.generateSignature(params);

            const url = new URL('https://api.ok.ru/fb.do');
            Object.entries(params).forEach(([key, val]) => url.searchParams.append(key, val));
            url.searchParams.append('sig', sig);
            url.searchParams.append('access_token', this.accessToken);

            const res = await fetch(url.toString(), { method: 'POST' });
            const json = await res.json();

            if (json.error_code) {
                throw new Error(`OK API Error: ${json.error_msg} (code ${json.error_code})`);
            }

            // OK returns the topic ID as a string or in quotes
            const topicId = String(json).replace(/"/g, '');

            return {
                success: true,
                external_id: topicId,
                published_url: `https://ok.ru/group/${this.groupId}/topic/${topicId}`
            };

        } catch (e: any) {
            console.error("OK Publish Error:", e);
            return { success: false, error: e.message };
        }
    }

    private async uploadPhoto(imageUrl: string): Promise<string> {
        // A. Get Upload URL
        const params: Record<string, string> = {
            "application_key": this.applicationKey,
            "count": "1",
            "format": "json",
            "gid": this.groupId,
            "method": "photosV2.getUploadUrl"
        };

        const sig = this.generateSignature(params);

        const url = new URL('https://api.ok.ru/fb.do');
        Object.entries(params).forEach(([key, val]) => url.searchParams.append(key, val));
        url.searchParams.append('sig', sig);
        url.searchParams.append('access_token', this.accessToken);

        const serverRes = await fetch(url.toString(), { method: 'POST' });
        const serverJson = await serverRes.json();

        if (!serverJson.upload_url) {
            throw new Error(`Failed to get OK upload URL: ${JSON.stringify(serverJson)}`);
        }

        const uploadUrl = serverJson.upload_url;

        // B. Download Image
        const imgRes = await fetch(imageUrl);
        const blob = await imgRes.blob();

        const form = new FormData();
        form.append('photo', blob, 'image.jpg');

        // C. Upload
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            body: form
        });
        const uploadData = await uploadRes.json();

        // D. Extract Token
        // OK returns { photos: { "id": { token: "..." } } }
        const photos = uploadData.photos;
        if (!photos) {
            throw new Error(`OK Upload failed: ${JSON.stringify(uploadData)}`);
        }

        const firstPhotoId = Object.keys(photos)[0];
        const token = photos[firstPhotoId].token;

        if (!token) {
            throw new Error("No photo token returned from OK");
        }

        return token;
    }
}
