import { IPublisher, PublishContext, PublishResult } from './types';

export class VkPublisher implements IPublisher {
    private accessToken: string;
    private ownerId: number; // can be negative (group) or positive (user)
    private version = '5.199'; // Latest-ish

    constructor(accessToken: string, ownerId: string | number) {
        this.accessToken = accessToken;
        this.ownerId = Number(ownerId);
    }

    async publish(context: PublishContext): Promise<PublishResult> {
        try {
            if (!this.accessToken) throw new Error("VK Publish Failed: No Access Token");
            if (!this.ownerId) throw new Error("VK Publish Failed: No Owner ID");

            let attachments: string[] = [];

            // 1. Upload Image if exists
            if (context.image_url) {
                try {
                    const photoAttachment = await this.uploadPhoto(context.image_url);
                    if (photoAttachment) {
                        attachments.push(photoAttachment);
                    }
                } catch (e) {
                    console.error("[VK] Image upload failed, proceeding with text only", e);
                }
            }

            // 2. Prepare Message
            // VK typically uses plain text, but accepts links.
            // If source_url is present, we append it.
            let message = context.content_html || context.title;

            // Basic cleanup of HTML tags for VK (VK doesn't support HTML, only plain text w/ links)
            // But strict requirement says: "content_html" might be HTML. 
            // We should strip tags or conversion.
            // For now, simple strip or just send as is (VK might show clean text if lucky, but usually needs cleanup)
            message = message.replace(/<[^>]*>/g, '');

            if (context.title && !message.startsWith(context.title)) {
                message = `${context.title}\n\n${message}`;
            }

            const plainContentForLink = (context.content_html || '').replace(/<[^>]*>/g, '').trim();
            const lastColonIndex = plainContentForLink.lastIndexOf(':');
            const shouldAttachLink = lastColonIndex !== -1 && /^[:]\s*[\uD800-\uDBFF\uDC00-\uDFFF\s]*$/.test(plainContentForLink.substring(lastColonIndex));

            if (shouldAttachLink && context.source_url) {
                if (!message.includes(context.source_url)) {
                    message += `\n\n${context.source_url}`;
                }
                if (attachments.length === 0) {
                    attachments.push(context.source_url);
                }
            }

            // 3. Post to Wall
            const postId = await this.postToWall(message, attachments);

            return {
                success: true,
                external_id: String(postId),
                published_url: `https://vk.com/wall${this.ownerId}_${postId}`
            };

        } catch (e: any) {
            console.error("VK Publish Error:", e);
            return { success: false, error: e.message };
        }
    }

    private async callApi(method: string, params: Record<string, any>) {
        const url = new URL(`https://api.vk.com/method/${method}`);

        // Append params
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, String(params[key]));
            }
        });

        // Auth params
        url.searchParams.append('access_token', this.accessToken);
        url.searchParams.append('v', this.version);

        const res = await fetch(url.toString());
        const json = await res.json();

        if (json.error) {
            throw new Error(`VK API Error [${method}]: ${json.error.error_msg} (code ${json.error.error_code})`);
        }
        return json.response;
    }

    private async uploadPhoto(imageUrl: string): Promise<string> {
        // A. Get Upload Server
        // post to group wall?
        let groupId = 0;
        if (this.ownerId < 0) {
            groupId = Math.abs(this.ownerId);
        }

        const serverRes = await this.callApi('photos.getWallUploadServer', {
            group_id: groupId || undefined
        });

        const uploadUrl = serverRes.upload_url;

        // B. Download Image
        const imgRes = await fetch(imageUrl);
        const blob = await imgRes.blob();

        const form = new FormData();
        form.append('photo', blob, 'image.jpg');

        // C. Upload
        const uploadPostRes = await fetch(uploadUrl, {
            method: 'POST',
            body: form
        });
        const uploadData = await uploadPostRes.json();

        // D. Save
        const saveRes = await this.callApi('photos.saveWallPhoto', {
            group_id: groupId || undefined,
            photo: uploadData.photo,
            server: uploadData.server,
            hash: uploadData.hash
        });

        if (!saveRes || saveRes.length === 0) {
            throw new Error("Failed to save photo");
        }

        const photo = saveRes[0];
        // Format: photo{owner_id}_{id}
        return `photo${photo.owner_id}_${photo.id}`;
    }

    private async postToWall(message: string, attachments: string[]) {
        const res = await this.callApi('wall.post', {
            owner_id: this.ownerId,
            from_group: this.ownerId < 0 ? 1 : 0,
            message: message,
            attachments: attachments.join(',')
        });
        return res.post_id;
    }
}
