'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function regenerateNewsImage(itemId: string, itemType: 'news' | 'review', customPrompt?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        console.log(`[ImageAction] Regenerating image for ${itemType}: ${itemId}`)
        const table = itemType === 'review' ? 'review_items' : 'news_items'

        // 1. Fetch item data
        const { data: rawItem, error: fetchError } = await supabase
            .from(table)
            .select('*')
            .eq('id', itemId)
            .single()

        if (fetchError || !rawItem) throw new Error(`${itemType} item not found`)
        const item = rawItem as any

        // 2. Determine prompt
        const { callAI } = await import('@/lib/ai-service')

        const context = `Article context (short):
${(item.draft_announce || item.draft_longread || '').substring(0, 1000)}

Admin visual notes (optional):
${customPrompt || 'No specific notes.'}`

        // Fetch image_prompt config
        const { data: promptData } = await (supabase
            .from('system_prompts')
            .select('content, provider, model, temperature')
            .eq('key', 'image_prompt')
            .single() as any)

        const systemInstruction = promptData?.content || 'Составь подробный, но лаконичный промт (на английском) для генерации тематического изображения (DALL-E 3), учитывая контекст статьи и пожелания админа. Промт должен быть описательным и визуальным.'

        const config = promptData ? {
            provider: promptData.provider,
            model: promptData.model,
            temperature: promptData.temperature
        } : undefined

        const prompt = await callAI(systemInstruction, context, config)

        if (!prompt) throw new Error('Failed to determine image prompt')

        // 3. Generate Image
        const { generateImage } = await import('@/lib/ai-service')
        const imageUrl = await generateImage(prompt)

        // 4. Upload to Telegram (to store persistent file_id)
        const { sendPhotoToTelegram } = await import('@/lib/telegram-service')

        let chatId = item.approve1_chat_id || item.approve2_chat_id

        if (!chatId) {
            const adminDb = createAdminClient()
            const { data: chats } = await adminDb.from('telegram_chats').select('chat_id').eq('purpose', 'approve').single()
            chatId = chats?.chat_id
        }

        let fileId = null
        if (chatId) {
            const sent = await sendPhotoToTelegram(chatId, imageUrl, 'Regenerated Image')
            fileId = sent.file_id
        }

        // 5. Update Database
        const { error: updateError } = await supabase
            .from(table)
            .update({
                draft_image_prompt: prompt,
                draft_image_url: imageUrl,
                draft_image_file_id: fileId,
                drafts_updated_at: new Date().toISOString()
            })
            .eq('id', itemId)

        if (updateError) throw updateError

        revalidatePath('/content')
        return { success: true, imageUrl, prompt }

    } catch (error: any) {
        console.error('Regenerate Image Error:', error)
        return { success: false, error: error.message }
    }
}

export async function updateItemImage(itemId: string, itemType: 'news' | 'review', fileId: string) {
    const supabase = await createClient()
    const table = itemType === 'review' ? 'review_items' : 'news_items'

    try {
        const { error } = await supabase
            .from(table)
            .update({
                draft_image_file_id: fileId,
                draft_image_url: null, // Clear URL to prioritize file_id from TG
                drafts_updated_at: new Date().toISOString()
            })
            .eq('id', itemId)

        if (error) throw error

        revalidatePath('/content')
        return { success: true }
    } catch (e: any) {
        console.error('[updateItemImage] Error:', e)
        return { success: false, error: e.message }
    }
}

