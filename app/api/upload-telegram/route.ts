import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Инициализируем админ-клиент Supabase для получения секретов
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Получаем токен из базы
        const { data: settings, error: settingsError } = await supabase
            .from('project_settings')
            .select('key, value')
            .eq('project_key', 'ainews')
            .in('key', ['telegram_bot_token', 'tg_bot', 'telegram_draft_chat_id'])

        const token =
            (settings as any[])?.find((r) => r.key === 'telegram_bot_token')?.value ||
            (settings as any[])?.find((r) => r.key === 'tg_bot')?.value

        const chatId = (settings as any[])?.find((r) => r.key === 'telegram_draft_chat_id')?.value

        if (settingsError || !token || !chatId) {
            console.error('Settings fetch error:', settingsError)
            return NextResponse.json({
                error: `Server configuration error: ${!token ? 'Token' : 'Draft Chat ID'} missing in project settings`
            }, { status: 500 })
        }

        // Отправляем в Telegram
        const tgFormData = new FormData()
        tgFormData.append('chat_id', chatId)
        tgFormData.append('photo', file)

        const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: tgFormData,
        })

        const data = await response.json()

        if (!data.ok) {
            console.error('Telegram API Error:', data);
            return NextResponse.json({ error: 'Telegram upload failed', details: data }, { status: 502 })
        }

        // Берем file_id самой большой фотографии
        const photos = data.result.photo
        // Telegram возвращает массив размеров фото. Последний — самый большой.
        // Пример: [{file_id: 'small', ...}, {file_id: 'medium', ...}, {file_id: 'large', ...}]
        const bestPhoto = photos[photos.length - 1]

        return NextResponse.json({ file_id: bestPhoto.file_id })

    } catch (error: any) {
        console.error('Upload handler error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
