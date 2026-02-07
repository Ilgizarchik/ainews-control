import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ file_id: string }> }
) {
    try {
        const { file_id: fileId } = await params

        if (!fileId) {
            return NextResponse.json({ error: 'file_id is required' }, { status: 400 })
        }

        // Helper to get bot token (Cached)
        const getBotToken = unstable_cache(
            async () => {
                const supabase = createAdminClient()
                // @ts-ignore
                const { data } = await supabase
                    .from('project_settings')
                    .select('key, value')
                    .eq('project_key', 'ainews')
                    .in('key', ['telegram_bot_token', 'tg_bot'])

                const token =
                    (data as any[])?.find((r) => r.key === 'telegram_bot_token')?.value ||
                    (data as any[])?.find((r) => r.key === 'tg_bot')?.value

                return token as string
            },
            ['tg-bot-token'],
            { revalidate: 3600 } // 1 hour cache
        )

        const botToken = await getBotToken()
        if (!botToken) throw new Error('Bot token not configured')

        // Helper to get file path (Cached for short time as URLs expire)
        const getFilePath = unstable_cache(
            async (token: string, fId: string) => {
                const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fId}`)
                if (!res.ok) throw new Error('Failed to get file info')
                const data = await res.json()
                if (!data.ok || !data.result?.file_path) throw new Error('Invalid file info')
                return data.result.file_path as string
            },
            [`tg-file-path-${fileId}`],
            { revalidate: 1800 } // 30 min cache (Telegram links live ~1h)
        )

        const filePath = await getFilePath(botToken, fileId)

        // 2. Скачиваем файл
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
        const fileResponse = await fetch(fileUrl)

        if (!fileResponse.ok) {
            console.error(`[Telegram API] Download error:`, fileResponse.statusText)
            throw new Error('Failed to download file from Telegram')
        }

        // 3. Возвращаем изображение
        const imageBuffer = await fileResponse.arrayBuffer()
        const contentType = fileResponse.headers.get('content-type') || 'image/jpeg'

        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch (error: any) {
        console.error('Error fetching Telegram photo:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch photo' },
            { status: 500 }
        )
    }
}
