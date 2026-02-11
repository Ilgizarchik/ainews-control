import { createAdminClient } from '@/lib/supabase/admin'

export async function logErrorToTelegram(error: unknown, context: string) {
    try {
        const supabase = createAdminClient()

        // Получаем токен бота
        const { data: settings } = await supabase
            .from('project_settings')
            .select('key, value')
            .eq('project_key', 'ainews')
            .in('key', ['telegram_bot_token', 'tg_bot', 'telegram_error_chat_id'])

        const token =
            settings?.find(s => s.key === 'telegram_bot_token')?.value ||
            settings?.find(s => s.key === 'tg_bot')?.value
        let chatId = settings?.find(s => s.key === 'telegram_error_chat_id')?.value

        // Если чат для ошибок не задан, фолбэк на чат approve
        if (!chatId) {
            const { data: chat } = await supabase
                .from('telegram_chats')
                .select('chat_id')
                .eq('purpose', 'approve')
                .eq('project_key', 'ainews')
                .single()
            chatId = chat?.chat_id ? String(chat.chat_id) : undefined
        }

        if (!token || !chatId) {
            console.warn('[Logger] Missing Telegram configuration for logging')
            return
        }

        const message = `[DASHBOARD ERROR]\n\n` +
            `Context: ${context}\n` +
            `Message: ${error instanceof Error ? error.message : String(error)}\n\n` +
            `#error #dashboard`

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message
            })
        })

        if (!res.ok) {
            const text = await res.text().catch(() => '')
            console.warn('[Logger] Telegram send failed:', res.status, text)
        }
    } catch (e) {
        console.error('[Logger] Failed to send error to Telegram:', e)
    }
}
