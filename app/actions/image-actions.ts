'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function regenerateNewsImage(newsId: string, customPrompt?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        console.log(`[ImageAction] Regenerating image for ${newsId}`)

        // 1. Fetch news data
        const { data: rawNewsItem, error: fetchError } = await supabase
            .from('news_items')
            .select('*')
            .eq('id', newsId)
            .single()

        if (fetchError || !rawNewsItem) throw new Error('News item not found')
        const newsItem = rawNewsItem as any

        // 2. Determine prompt
        // We act as an Agent: combine context (Announce) + Admin Notes -> Final Image Prompt
        const { callAI } = await import('@/lib/ai-service')

        const context = `Article context (short):
${(newsItem.draft_announce || newsItem.draft_longread || '').substring(0, 1000)}

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

        // Use approve chat ID if available, or fallback
        // We use admin client to get settings if needed, but fetch from newsItem first
        let chatId = newsItem.approve1_chat_id || newsItem.approve2_chat_id

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
        const { error: updateError } = await (supabase
            .from('news_items') as any)
            .update({
                draft_image_prompt: prompt,
                draft_image_url: imageUrl,
                draft_image_file_id: fileId,
                drafts_updated_at: new Date().toISOString()
            })
            .eq('id', newsId)

        if (updateError) throw updateError

        revalidatePath('/content')
        return { success: true, imageUrl, prompt }

    } catch (error: any) {
        console.error('Regenerate Image Error:', error)
        return { success: false, error: error.message }
    }
}
