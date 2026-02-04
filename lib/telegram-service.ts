import { fetch as undiciFetch } from 'undici';
import { createAdminClient } from '@/lib/supabase/admin';
import { unstable_cache } from 'next/cache';

const getBotToken = unstable_cache(
    async () => {
        const supabase = createAdminClient();
        // @ts-ignore
        const { data } = await supabase
            .from('project_settings')
            .select('value')
            .eq('project_key', 'ainews')
            .eq('key', 'tg_bot')
            .single();

        return (data as any)?.value as string;
    },
    ['tg-bot-token'],
    { revalidate: 3600 }
);

export async function sendPhotoToTelegram(chatId: string | number, photoUrl: string, caption?: string): Promise<{ file_id: string, message_id: number }> {
    const token = await getBotToken();
    if (!token) throw new Error('Telegram Bot Token not configured');

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;

    const body = {
        chat_id: chatId,
        photo: photoUrl,
        caption: caption || '',
        parse_mode: 'HTML'
    };

    const response = await undiciFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
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
