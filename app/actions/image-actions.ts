'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function regenerateNewsImage(itemId: string, itemType: 'news' | 'review', customPrompt?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
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
        const { sendPhotoToTelegram, getDraftChatId } = await import('@/lib/telegram-service')

        // Priority: 1) Existing moderation chat, 2) Global draft chat from settings
        const draftChatId = await getDraftChatId()
        const finalChatId = item.approve1_chat_id || item.approve2_chat_id || draftChatId

        let fileId = null
        if (finalChatId) {
            try {
                const sent = await sendPhotoToTelegram(finalChatId, imageUrl, 'Regenerated Image')
                fileId = sent.file_id
            } catch (tgError) {
                console.error('[ImageAction] Telegram upload failed, but DB will be updated with direct URL:', tgError)
                // We proceed so at least the URL is saved in DB
            }
        } else {
            console.warn('[ImageAction] No chat ID found for Telegram upload. Skipping.')
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

