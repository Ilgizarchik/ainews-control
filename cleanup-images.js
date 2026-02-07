import { createAdminClient } from './lib/supabase/admin.js';
import { sendPhotoToTelegram, getDraftChatId } from './lib/telegram-service.js';

async function cleanup() {
    console.log('🚀 Starting database image cleanup...');
    const supabase = createAdminClient();

    // Find news items with large base64 images
    const { data: items, error } = await supabase
        .from('news_items')
        .select('id, title, draft_image_url, draft_image_file_id')
        .not('draft_image_url', 'is', null)
        .is('draft_image_file_id', null);

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    const base64Items = items.filter(it => it.draft_image_url.startsWith('data:image'));
    console.log(`Found ${base64Items.length} items with Base64 images to process.`);

    const chatId = await getDraftChatId();
    if (!chatId) {
        console.error('Technical chat ID (telegram_draft_chat_id) not found in settings!');
        return;
    }

    for (const item of base64Items) {
        console.log(`Processing: ${item.title || item.id}`);
        try {
            // 1. Send to Telegram
            const { file_id } = await sendPhotoToTelegram(chatId, item.draft_image_url, `Cleanup migration: ${item.title}`);
            console.log(`✅ Uploaded to TG. File ID: ${file_id}`);

            // 2. Update DB
            const { error: updateError } = await supabase
                .from('news_items')
                .update({
                    draft_image_file_id: file_id,
                    draft_image_url: null, // Clear the heavy base64
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id);

            if (updateError) {
                console.error(`❌ Failed to update DB for ${item.id}:`, updateError);
            } else {
                console.log(`✨ DB updated, Base64 cleared for ${item.id}`);
            }
        } catch (e) {
            console.error(`❌ Failed processing ${item.id}:`, e.message);
        }
    }

    console.log('🏁 Cleanup finished.');
}

cleanup().catch(console.error);
