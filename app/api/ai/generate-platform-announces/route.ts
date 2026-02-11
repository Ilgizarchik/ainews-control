import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callAI } from '@/lib/ai-service'

type GeneratePlatformAnnouncesRequest = {
    review_id?: string
    news_id?: string
    platforms: string[] // ['tg', 'vk', 'ok' и т.д.]
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    try {
        const { review_id, news_id, platforms }: GeneratePlatformAnnouncesRequest = await req.json()
        const contentId = review_id || news_id
        let tableName = news_id ? 'news_items' : 'review_items'

        if (!contentId || !platforms || platforms.length === 0) {
            return NextResponse.json({ error: 'ID and platforms are required' }, { status: 400 })
        }

        // 1. Получаем элемент контента (контекст пользователя)
        // 1. Получаем элемент контента (контекст пользователя) — с надежной проверкой
        let item: any = null
        let { data, error: fetchError } = await (supabase
            .from(tableName)
            .select('draft_announce, draft_title, draft_longread, draft_longread_site')
            .eq('id', contentId)
            .single() as any)

        if (!fetchError && data) {
            item = data
        } else {
            // Пробуем таблицу-фолбэк
            const fallbackTable = tableName === 'news_items' ? 'review_items' : 'news_items'
            const { data: fallbackData, error: fallbackError } = await (supabase
                .from(fallbackTable)
                .select('draft_announce, draft_title, draft_longread, draft_longread_site')
                .eq('id', contentId)
                .single() as any)

            if (fallbackData && !fallbackError) {
                item = fallbackData
                tableName = fallbackTable // ВАЖНО: обновляем имя таблицы для дальнейших апдейтов
                console.log(`[GenerateAnnounce] Relocated item ${contentId} in ${tableName}`)
            }
        }

        if (!item) {
            return NextResponse.json({ error: 'Content item not found in any table' }, { status: 404 })
        }

        const baseAnnounce = item.draft_announce || ''
        const title = item.draft_title || ''
        // Логика выбора источника (ОТКАТЕНО):
        // - SITE: всегда генерируем из полного лонгрида (`draft_longread`)
        // - SOCIALS: всегда генерируем из короткого анонса (`draft_announce`) по запросу
        const getSourceForPlatform = (platform: string) => {
            if (platform === 'site') {
                return item.draft_longread || item.draft_announce
            }
            // Для TG, VK, OK и т.д. — используем короткий анонс
            return item.draft_announce || item.draft_longread
        }

        if (!baseAnnounce && !item.draft_longread) {
            return NextResponse.json({ error: 'No content to process' }, { status: 400 })
        }

        // 2. Берем ВСЕ промпты для надежности (таблица небольшая)
        const { data: promptsData, error: promptsError } = await (supabaseAdmin
            .from('system_prompts')
            .select('key, content, provider, model, temperature') as any)

        if (promptsError) {
            console.error("Prompts fetch error:", promptsError)
            throw promptsError
        }


        // Мапим конфиги
        const promptMap = (promptsData as any[]).reduce((acc, p) => ({
            ...acc,
            [p.key.trim()]: p
        }), {} as Record<string, { content: string, provider?: string, model?: string, temperature?: number }>)

        // 3. Генерируем анонсы для каждой платформы
        const results: Record<string, string> = {}

        for (const platform of platforms) {
            const promptKey = `rewrite_social_${platform.toLowerCase()}`
            const promptData = promptMap[promptKey]

            if (!promptData) {
                console.warn(`Prompt not found for platform: ${platform} (key: ${promptKey})`)
                // Фолбэк: пробуем ключ без префикса или просто логируем доступные ключи
                console.warn('Available keys:', Object.keys(promptMap))
                continue
            }

            try {
                // Определяем исходный контент: предпочитаем лонгрид для лучшего контекста
                const sourceContent = getSourceForPlatform(platform)

                if (!sourceContent) {
                    results[platform] = `[Нет исходного контента для ${platform}]`
                    continue
                }

                // Этап 1: Генерация текста
                const config = {
                    provider: promptData.provider,
                    model: promptData.model,
                    temperature: promptData.temperature,
                    maxTokens: platform === 'site' ? 12000 : 6000 // Высокие лимиты для reasoning-моделей
                }

                let generatedText = await callAI(
                    promptData.content,
                    `Название: ${title}\n\nИсходный текст:\n${sourceContent}`,
                    config
                )

                // Этап 2: Для Telegram добавляем обработку эмодзи
                if (platform === 'tg' && promptMap['rewrite_social_tg_emoji']) {
                    const emojiPrompt = promptMap['rewrite_social_tg_emoji']
                    const emojiConfig = {
                        provider: emojiPrompt.provider,
                        model: emojiPrompt.model,
                        temperature: emojiPrompt.temperature
                    }

                    generatedText = await callAI(
                        emojiPrompt.content,
                        generatedText,
                        emojiConfig
                    )
                }

                results[platform] = generatedText.trim()

                // ИНКРЕМЕНТАЛЬНОЕ СОХРАНЕНИЕ: обновляем БД сразу для защиты от разрывов/таймаутов клиента
                const platformKey = platform === 'site' ? 'draft_longread_site' : `draft_announce_${platform}`
                const { error: updateError } = await supabase
                    .from(tableName as any)
                    .update({ [platformKey]: generatedText.trim() })
                    .eq('id', contentId)

                if (updateError) {
                    console.error(`[GenerateAnnounce] DB Update Error for ${platform}:`, updateError)
                }

            } catch (error: any) {
                console.error(`Error generating announce for ${platform}:`, error)
                results[platform] = `[Ошибка генерации: ${error.message}]`
            }
        }

        // Массовое обновление в конце больше не нужно



        return NextResponse.json({
            success: true,
            results,
            message: `Generated announces for ${Object.keys(results).length} platforms`
        })

    } catch (error: any) {
        console.error('Error in generate-platform-announces:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
