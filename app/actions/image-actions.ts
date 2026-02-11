'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'

export async function regenerateNewsImage(itemId: string, itemType: 'news' | 'review', customPrompt?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Используем админ-клиент для операций с БД ради надежности
    const adminDb = createAdminClient()

    if (!user) {
        console.warn('[regenerateNewsImage] User not found in session, proceeding with admin client (assuming protected route)')
    }

    try {
        const table = itemType === 'review' ? 'review_items' : 'news_items'

        // 1. Получаем данные элемента
        const { data: rawItem, error: fetchError } = await adminDb
            .from(table)
            .select('*')
            .eq('id', itemId)
            .single()

        if (fetchError || !rawItem) throw new Error(`${itemType} item not found`)
        const item = rawItem as any

        // 2. Определяем промпт
        const { callAI } = await import('@/lib/ai-service')

        const context = `Article context (short):
${(item.draft_announce || item.draft_longread || '').substring(0, 1000)}

Admin visual notes (optional):
${customPrompt || 'No specific notes.'}`

        // Получаем конфиг image_prompt
        const { data: promptData } = await (adminDb
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

        // 3. Генерируем изображение
        const { generateImage } = await import('@/lib/ai-service')
        const imageUrl = await generateImage(prompt)

        // 4. Загружаем в Telegram (чтобы получить постоянный file_id)
        const { sendPhotoToTelegram, getDraftChatId } = await import('@/lib/telegram-service')

        // Приоритет: 1) существующий чат модерации, 2) глобальный черновой чат из настроек
        const draftChatId = await getDraftChatId()
        const finalChatId = draftChatId || item.approve1_chat_id || item.approve2_chat_id

        let fileId = null
        if (finalChatId) {
            try {
                const sent = await sendPhotoToTelegram(finalChatId, imageUrl, 'Regenerated Image')
                fileId = sent.file_id
            } catch (tgError) {
                console.error('[ImageAction] Telegram upload failed, but DB will be updated with direct URL:', tgError)
                // Продолжаем, чтобы хотя бы URL сохранился в БД
            }
        } else {
            console.warn('[ImageAction] No chat ID found for Telegram upload. Skipping.')
        }

        // 5. Обновляем базу
        const { error: updateError } = await adminDb
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
    // Используем админ-клиент для операций с БД
    const adminDb = createAdminClient()
    const table = itemType === 'review' ? 'review_items' : 'news_items'

    try {
        const { error } = await adminDb
            .from(table)
            .update({
                draft_image_file_id: fileId,
                draft_image_url: null, // Очищаем URL, чтобы приоритет был у file_id из TG
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

