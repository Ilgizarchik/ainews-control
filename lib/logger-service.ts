import { createAdminClient } from '@/lib/supabase/admin';

export async function logErrorToTelegram(error: any, context: string) {
    try {
        const supabase = createAdminClient();

        // Fetch bot token
        const { data: settings } = await supabase
            .from('project_settings')
            .select('value')
            .eq('key', 'tg_bot')
            .single();

        const token = settings?.value;

        // Fetch admin/approve chat ID for logging
        const { data: chat } = await supabase
            .from('telegram_chats')
            .select('chat_id')
            .eq('purpose', 'approve')
            .single();

        const chatId = chat?.chat_id;

        if (!token || !chatId) {
            console.warn('[Logger] Missing Telegram configuration for logging');
            return;
        }

        const message = `❌ *ОШИБКА ДАШБОРДА*\n\n` +
            `*Контекст:* ${context}\n` +
            `*Сообщение:* ${error instanceof Error ? error.message : String(error)}\n\n` +
            `#error #dashboard`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

    } catch (e) {
        console.error('[Logger] Failed to send error to Telegram:', e);
    }
}
