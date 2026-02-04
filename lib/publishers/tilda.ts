import { IPublisher, PublishContext, PublishResult } from './types'
import * as cheerio from 'cheerio'
// Removed 'form-data' import to use native FormData

export class TildaPublisher implements IPublisher {
    private cookies: string;
    private projectId: string;
    private feedUid: string;

    constructor(cookies: string, projectId: string, feedUid: string) {
        if (cookies && !cookies.includes(';') && !cookies.includes('=')) {
            this.cookies = `PHPSESSID=${cookies}`;
        } else {
            this.cookies = cookies;
        }
        this.projectId = projectId;
        this.feedUid = feedUid;
    }

    async publish(context: PublishContext): Promise<PublishResult> {
        try {
            if (!this.cookies) throw new Error("Tilda Cookies missing");
            if (!this.projectId) throw new Error("Tilda Project ID missing");
            if (!this.feedUid) throw new Error("Tilda Feed UID missing");

            // 1. GET KEYS 
            const keys = await this.fetchTildaKeys();
            if (!keys.publickey || !keys.uploadkey) {
                return { success: false, error: "Failed to extract Tilda keys (Session might be expired)" };
            }

            const validKeys = {
                publickey: keys.publickey,
                uploadkey: keys.uploadkey
            } as { publickey: string, uploadkey: string };

            // 2. Upload Image (if exists)
            let imageUrl = '';
            if (context.image_url) {
                try {
                    console.log(`[Tilda] Starting image upload for: ${context.image_url}`);
                    imageUrl = await this.uploadImageToTilda(context.image_url, validKeys);
                    if (!imageUrl) {
                        throw new Error("Upload returned empty URL (check logs)");
                    }
                } catch (e: any) {
                    console.error("[Tilda] Aborting publish due to image upload failure:", e);
                    return { success: false, error: `Image Upload Failed: ${e.message}` };
                }
            }

            // 3. Create Post
            const postResult = await this.createPost(context, validKeys, imageUrl);
            return postResult;

        } catch (e: any) {
            console.error("Tilda Publish Error:", e);
            return { success: false, error: e.message };
        }
    }

    private getCommonHeaders() {
        return {
            'Cookie': this.cookies,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };
    }

    public async validateSession(): Promise<any> {
        try {
            const res = await fetch('https://tilda.ru/identity/get/getprofile/', {
                method: 'POST',
                headers: {
                    ...this.getCommonHeaders(),
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Referer': 'https://tilda.ru/identity/',
                    'Origin': 'https://tilda.ru'
                },
                body: 'comm=getprofile'
            });
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch {
                return { error: 'Non-JSON response', raw: text.substring(0, 200) };
            }
        } catch (e: any) {
            return { error: e.message };
        }
    }

    private async fetchTildaKeys() {
        const pId = String(this.projectId || '').trim();
        const fId = String(this.feedUid || '').trim();

        const url = `https://feeds.tilda.ru/posts/?feeduid=${fId}&projectid=${pId}`;
        console.log(`[Tilda] Fetching keys from ${url} with cookies (len=${this.cookies.length})`);

        const res = await fetch(url, {
            headers: this.getCommonHeaders(),
            redirect: 'manual'
        });

        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location');
            throw new Error(`Tilda Redirected (Session Invalid?): ${res.status} to ${loc}`);
        }

        if (!res.ok) {
            throw new Error(`Tilda Http Check failed: ${res.status} ${res.statusText}`);
        }

        const html = await res.text();

        if (html.includes('Недостаточно данных')) {
            throw new Error(`Tilda returned specific error: "Недостаточно данных". URL was: ${url}`);
        }

        const $ = cheerio.load(html);

        const publickeyMatch = html.match(/publickey\s*[:=]\s*["']([^"']+)["']/i) || html.match(/name=["']publickey["']\s+value=["']([^"']+)["']/i);
        const uploadkeyMatch = html.match(/uploadkey\s*[:=]\s*["']([^"']+)["']/i) || html.match(/name=["']uploadkey["']\s+value=["']([^"']+)["']/i);

        if (!publickeyMatch?.[1] || !uploadkeyMatch?.[1]) {
            const snippet = html.substring(0, 1000).replace(/(\r\n|\n|\r)/gm, " ");
            console.error('[Tilda] Failed to extract keys. Snippet:', snippet);
            throw new Error(`Failed to extract Tilda keys. Server response snippet: ${snippet}`);
        }

        return {
            publickey: publickeyMatch?.[1],
            uploadkey: uploadkeyMatch?.[1]
        };
    }

    private async uploadImageToTilda(sourceUrl: string, keys: { publickey: string, uploadkey: string }) {
        let uploadText = '';
        try {
            // 1. Download image first
            const imgRes = await fetch(sourceUrl);
            if (!imgRes.ok) throw new Error(`Failed to download source image: ${imgRes.status}`);
            const blob = await imgRes.blob();

            // 2. Prepare FormData (Native)
            // Note: In Next.js/Node 18+, FormData is global.
            const form = new FormData();
            form.append('publickey', keys.publickey);
            form.append('uploadkey', keys.uploadkey);
            // Append blob directly. 'image.jpg' is the filename.
            form.append('file', blob, 'image.jpg');

            // 3. Send to Tilda Upload API
            const uploadUrl = `https://upload.tildacdn.com/api/upload/?publickey=${keys.publickey}&uploadkey=${keys.uploadkey}`;

            console.log(`[Tilda] Uploading image (Blob size: ${blob.size}) to ${uploadUrl}`);

            const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    // Do NOT set Content-Type manually with native FormData; fetch sets boundary.
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                    'Origin': 'https://feeds.tilda.ru',
                    'Referer': 'https://feeds.tilda.ru/',
                    'Pragma': 'no-cache',
                    'Priority': 'u=1, i',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'cross-site',
                    'x-requested-with': 'XMLHttpRequest',
                },
                body: form
            });

            uploadText = await uploadRes.text();
            let uploadJson: any = {};
            try {
                uploadJson = JSON.parse(uploadText);
            } catch {
                throw new Error(`Non-JSON response from Tilda Upload: ${uploadText.substring(0, 100)}`);
            }

            const result = uploadJson.result?.[0] || uploadJson;
            const finalUrl = result.cdnUrl || result.url || result.file || '';

            if (!finalUrl) {
                console.error('[Tilda] Upload JSON contained no URL:', uploadJson);
                throw new Error(`Upload successful but no URL found in response: ${JSON.stringify(uploadJson)}`);
            }

            console.log(`[Tilda] Image Upload Success: ${finalUrl}`);
            return finalUrl;

        } catch (e: any) {
            console.error("[Tilda] Image Upload Exception:", e);
            if (uploadText) console.error("[Tilda] Response body was:", uploadText);
            throw e; // Rethrow to be caught in publish
        }
    }

    private async createPost(context: PublishContext, keys: { publickey: string, uploadkey: string }, imageUrl: string): Promise<PublishResult> {

        // --- STEP 1: CREATE DRAFT (posts_Add) ---
        // Switch to URLSearchParams (application/x-www-form-urlencoded) to match n8n behavior
        const paramsAdd = new URLSearchParams();
        paramsAdd.append('feeduid', this.feedUid);
        paramsAdd.append('partuid', '');
        paramsAdd.append('title', context.title);
        paramsAdd.append('action', 'posts_Add');

        console.log('[Tilda] Step 1: Creating Draft (posts_Add)...');

        const resAdd = await fetch('https://feeds.tilda.ru/submit/', {
            method: 'POST',
            headers: {
                ...this.getCommonHeaders(),
                'Origin': 'https://feeds.tilda.ru',
                'Referer': 'https://feeds.tilda.ru/',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: paramsAdd.toString()
        });

        // Parse Step 1 Response
        let postuid = '';
        try {
            const textAdd = await resAdd.text();
            let jsonAdd: any = {};
            try { jsonAdd = JSON.parse(textAdd); } catch { }

            postuid = jsonAdd.postuid || jsonAdd.data?.uid || jsonAdd.uid || jsonAdd.data?.postuid;

            if (!postuid && jsonAdd.error) {
                return { success: false, error: `Step 1 Failed: ${jsonAdd.error}`, raw_response: jsonAdd };
            }
            if (!postuid) {
                if (textAdd.includes('Недостаточно данных')) return { success: false, error: 'Tilda: Недостаточно данных (Step 1). Content-Type mismatched?', raw_response: textAdd };
                return { success: false, error: 'Step 1 Failed: No UID returned', raw_response: textAdd };
            }
            console.log(`[Tilda] Draft Created. UID: ${postuid}`);

        } catch (e: any) {
            return { success: false, error: `Step 1 Exception: ${e.message}` };
        }


        // --- STEP 2: UPDATE CONTENT (posts_Edit) ---

        // Prepare Content Blocks
        const paragraphs = context.content_html.split(/\n\s*\n/);
        const contentBlocks: any[] = [];

        if (imageUrl) {
            contentBlocks.push({ "ty": "image", "url": imageUrl, "zoomin": "y" });
        }

        paragraphs.forEach(p => {
            const clean = p.trim();
            if (clean.length > 0) {
                const htmlReady = clean.replace(/\n/g, '<br>');
                contentBlocks.push({ "ty": "text", "te": htmlReady });
            }
        });

        const textPayload = JSON.stringify(contentBlocks);

        // Form Data for Edit - STRICT N8N ORDER MATCH
        // Order in n8n UI: action, postuid, feeduid, title, text, mediatype, mediadata, image, thumb
        const paramsEdit = new URLSearchParams();
        paramsEdit.append('action', 'posts_Edit');
        paramsEdit.append('postuid', postuid);
        paramsEdit.append('feeduid', this.feedUid);
        paramsEdit.append('title', context.title);
        paramsEdit.append('text', textPayload);

        if (imageUrl) {
            paramsEdit.append('mediatype', 'image');
            paramsEdit.append('mediadata', '');
            paramsEdit.append('image', imageUrl);
            paramsEdit.append('thumb', imageUrl);
        }

        console.log('[Tilda] Step 2: Updating Content (posts_Edit)...');

        const resEdit = await fetch('https://feeds.tilda.ru/submit/', {
            method: 'POST',
            headers: {
                ...this.getCommonHeaders(),
                'Accept': '*/*',
                'Origin': 'https://feeds.tilda.ru',
                'Referer': 'https://feeds.tilda.ru/',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: paramsEdit.toString()
        });

        const respText = await resEdit.text();

        try {
            const data = JSON.parse(respText);
            if (data.error) {
                return { success: false, error: `Step 2 Error: ${data.error}`, raw_response: data };
            }
        } catch (e) {
            return { success: false, error: "Invalid JSON from Tilda (Step 2)", raw_response: respText };
        }

        // --- STEP 3: PUBLISH (posts_Active) ---
        console.log('[Tilda] Step 3: Activating Post (posts_Active)...');
        const paramsActive = new URLSearchParams();
        paramsActive.append('postuid', postuid);
        paramsActive.append('action', 'posts_Active');

        const resActive = await fetch('https://feeds.tilda.ru/submit/', {
            method: 'POST',
            headers: {
                ...this.getCommonHeaders(),
                'Accept': '*/*',
                'Origin': 'https://feeds.tilda.ru',
                'Referer': 'https://feeds.tilda.ru/',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: paramsActive.toString()
        });
        // We assume success if no hard error, but can check response if needed

        // --- STEP 4: GET LINK (posts_Get) ---
        console.log('[Tilda] Step 4: Getting Link (posts_Get)...');
        const paramsGet = new URLSearchParams();
        paramsGet.append('postuid', postuid);
        paramsGet.append('action', 'posts_Get');

        const resGet = await fetch('https://feeds.tilda.ru/submit/', {
            method: 'POST',
            headers: {
                ...this.getCommonHeaders(),
                'Accept': '*/*',
                'Origin': 'https://feeds.tilda.ru',
                'Referer': 'https://feeds.tilda.ru/',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: paramsGet.toString()
        });

        const getText = await resGet.text();
        let slug = '';
        let postData: any = {};

        try {
            const getData = JSON.parse(getText);
            postData = getData.post || getData.data || getData || {};
            // Tilda returns 'postdefaulturl' or 'slug'
            slug = postData.postdefaulturl || postData.slug || postData.postalias || postuid;
        } catch {
            console.error('[Tilda] Failed to parse Step 4 response', getText);
            slug = postuid;
        }

        return {
            success: true,
            external_id: postuid,
            published_url: `https://khc-ammunition.ru/tpost/${slug}`,
            raw_response: postData
        };
    }
}
