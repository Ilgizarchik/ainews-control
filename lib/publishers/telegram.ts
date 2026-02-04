import { IPublisher, PublishContext, PublishResult } from './types'

export class TelegramPublisher implements IPublisher {
    private botToken: string;
    private chatId: string; // Обычно это channel ID

    constructor(token: string, chatId?: string) {
        this.botToken = token;
        // Если chatId не передан в конструктор, он должен быть в context.config или жестко задан
        this.chatId = chatId || '';
    }

    async publish(context: PublishContext): Promise<PublishResult> {
        try {
            const chatId = this.chatId || context.config?.chat_id;
            if (!this.botToken) throw new Error("Telegram Bot Token is missing");
            if (!chatId) throw new Error("Telegram Chat ID is missing");

            // Smart Link Logic: Check if the text ends with a colon (ignoring trailing whitespace)
            const plainContent = context.content_html.replace(/<[^>]+>/g, '').trim();
            const shouldAttachLink = plainContent.endsWith(':');
            const linkPart = (shouldAttachLink && context.source_url) ? `\n${context.source_url}` : '';
            console.log(`[Telegram] Smart Link Check: endsWithColon=${shouldAttachLink}, sourceUrl=${context.source_url}`);

            // 1. Send Photo
            if (context.image_url) {
                // Caution: Truncating HTML is risky. We assume 'announce' (content_html) is short enough for caption.
                // If not, we rely on Telegram API to return error, and we fallback to text.
                const caption = `<b>${context.title}</b>\n\n${context.content_html}${linkPart}`;

                const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        photo: context.image_url,
                        caption: caption.substring(0, 1024), // Hard limit
                        parse_mode: 'HTML'
                    })
                });

                const data = await res.json();
                if (!data.ok) {
                    console.error("TG Photo failed, retrying text only", data);
                    // Fallthrough to text
                } else {
                    return {
                        success: true,
                        external_id: String(data.result.message_id),
                        raw_response: data
                    };
                }
            }

            // 2. Fallback / Text Mode
            // Limit 4096 chars
            const textUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const textBody = `<b>${context.title}</b>\n\n${context.content_html}${linkPart}`;

            const res = await fetch(textUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: textBody.substring(0, 4096),
                    parse_mode: 'HTML'
                })
            });

            const data = await res.json();
            if (!data.ok) {
                return { success: false, error: data.description || "Telegram API Error" };
            }

            return {
                success: true,
                external_id: String(data.result.message_id),
                raw_response: data
            };

        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
