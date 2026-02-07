import { fetch as undiciFetch } from 'undici';
import { createAdminClient } from '@/lib/supabase/admin';
import { unstable_cache } from 'next/cache';

async function fetchBotToken() {
    const supabase = createAdminClient();
    // @ts-ignore
    const { data } = await supabase
        .from('project_settings')
        .select('key, value')
        .eq('project_key', 'ainews')
        .in('key', ['telegram_bot_token', 'tg_bot']);

    return (data as any[])?.find((r) => r.key === 'telegram_bot_token')?.value ||
        (data as any[])?.find((r) => r.key === 'tg_bot')?.value;
}

const getBotToken = async () => {
    // Check if we are in Next.js environment with unstable_cache available
    if (typeof unstable_cache === 'function') {
        try {
            return await unstable_cache(
                fetchBotToken,
                ['tg-bot-token'],
                { revalidate: 3600 }
            )();
        } catch (e) {
            // Fallback to direct fetch if cache fails (e.g. standalone script)
            return await fetchBotToken();
        }
    }
    return await fetchBotToken();
};

/**
 * Gets the chat ID for draft images and technical notifications.
 * Priority: project_settings.telegram_draft_chat_id -> telegram_chats[purpose=approve]
 */
export async function getDraftChatId(): Promise<string | number | null> {
    const supabase = createAdminClient();

    // 1. Check project settings override
    const { data: setting } = await supabase
        .from('project_settings')
        .select('value')
        .eq('key', 'telegram_draft_chat_id')
        .eq('project_key', 'ainews')
        .single();

    if (setting?.value) return setting.value;

    // 2. Check telegram_chats table
    const { data: chat } = await supabase
        .from('telegram_chats')
        .select('chat_id')
        .eq('purpose', 'approve')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return chat?.chat_id || null;
}

export async function sendPhotoToTelegram(chatId: string | number, photoUrl: string, caption?: string): Promise<{ file_id: string, message_id: number }> {
    const token = await getBotToken();
    if (!token) throw new Error('Telegram Bot Token not configured');

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;

    let response;

    // Detect if valid base64 but without data: prefix
    let processedPhotoUrl = photoUrl;
    if (!photoUrl.startsWith('data:') && !photoUrl.startsWith('http') && photoUrl.length > 100) {
        // Assume it's a raw base64 string and try to wrap it
        processedPhotoUrl = `data:image/png;base64,${photoUrl}`;
    }

    if (processedPhotoUrl.startsWith('data:')) {
        // Handle Base64 Data URL by sending as a file (multipart/form-data)
        // Matching n8n logic: extract mimeType and base64 via string manipulation
        const comma = processedPhotoUrl.indexOf(",");
        if (comma === -1) throw new Error('Invalid Data URL: no comma found');

        const meta = processedPhotoUrl.slice(5, comma); // e.g. "image/png;base64"
        const mimeType = meta.split(";")[0] || 'image/png';
        const base64Data = processedPhotoUrl.slice(comma + 1);
        const buffer = Buffer.from(base64Data, 'base64');

        // Use form-data library (already in package.json)
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('chat_id', String(chatId));

        // Append as a file with filename and content type
        form.append('photo', buffer, {
            filename: 'image.png',
            contentType: mimeType,
        });

        if (caption) {
            form.append('caption', caption);
        }
        form.append('parse_mode', 'HTML');

        response = await undiciFetch(url, {
            method: 'POST',
            body: form.getBuffer(),
            headers: form.getHeaders()
        });
    } else {
        // Standard URL logic
        const body = {
            chat_id: chatId,
            photo: photoUrl,
            caption: caption || '',
            parse_mode: 'HTML'
        };

        response = await undiciFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        // FALLBACK: If Telegram failed to fetch the photo from the URL (e.g. OpenAI temporary link issues)
        // we download it ourselves and send as as file.
        if (!response.ok) {
            console.warn(`[Telegram] Send via URL failed (${response.status}). Attempting fallback: download and send as file...`);
            try {
                const fileRes = await undiciFetch(photoUrl);
                if (fileRes.ok) {
                    const arrayBuffer = await fileRes.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const mimeType = fileRes.headers.get('content-type') || 'image/jpeg';

                    const formData = new FormData();
                    formData.append('chat_id', String(chatId));
                    const blob = new Blob([buffer], { type: mimeType });
                    formData.append('photo', blob, 'image.jpg');
                    if (caption) formData.append('caption', caption);
                    formData.append('parse_mode', 'HTML');

                    response = await undiciFetch(url, {
                        method: 'POST',
                        body: formData as any
                    });
                }
            } catch (fallbackError) {
                console.error('[Telegram] Fallback download/send failed:', fallbackError);
                // Keep the original failed response to throw the error
            }
        }
    }

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[Telegram] API Error Details: ${errText}`);
        throw new Error(`Telegram API Error: ${response.status} - ${errText}`);
    }

    const data: any = await response.json();
    if (!data.ok) {
        throw new Error(`Telegram API Error: ${data.description}`);
    }

    const result = data.result;
    // result.photo is array of sizes, last one is biggest
    const bestPhoto = result.photo[result.photo.length - 1];

    return {
        file_id: bestPhoto.file_id,
        message_id: result.message_id
    };
}
