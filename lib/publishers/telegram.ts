import { IPublisher, PublishContext, PublishResult } from './types'
import { convertBbcodeToHtml } from '@/lib/utils'

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
            if (!this.botToken) throw new Error("Telegram Bot Token is missing");
            // If chatId is not provided in context, use the one from constructor
            const targetChatId = context.config?.telegram_channel_id || this.chatId;
            if (!targetChatId) throw new Error("Telegram Chat ID is missing");

            // Convert BBCode if present to HTML suitable for Telegram
            const finalHtml = convertBbcodeToHtml(context.content_html);
            const titleHtml = convertBbcodeToHtml(context.title);

            // 1. Плейсхолдер [LINK] (наивысший приоритет)
            let textWithLink = finalHtml;
            const linkHtml = context.source_url ? `<a href="${context.source_url}">${context.source_url}</a>` : '';

            if (context.source_url && textWithLink.includes('[LINK]')) {
                textWithLink = textWithLink.replace(/\[LINK\]/g, linkHtml);
            } else if (context.source_url) {
                // 2. Умная вставка при наличии двоеточия (старая логика + улучшение)
                const plainContent = finalHtml.replace(/<[^>]+>/g, '').trim();
                const shouldAttachLink = plainContent.endsWith(':') || finalHtml.trim().match(/:\s*(<[^>]+>)*$/) !== null;

                if (shouldAttachLink) {
                    textWithLink = `${textWithLink.trim()} ${linkHtml}`;
                }
            }

            // 1. Send Photo
            if (context.image_url) {
                // Caution: Truncating HTML is risky. We assume 'announce' (content_html) is short enough for caption.
                // If not, we rely on Telegram API to return error, and we fallback to text.
                const caption = textWithLink;

                const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: targetChatId,
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

            const textUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const textBody = textWithLink;

            const res = await fetch(textUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: targetChatId,
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
