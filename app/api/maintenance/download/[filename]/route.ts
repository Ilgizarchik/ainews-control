import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createServerClient } from '@supabase/ssr'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params

    // 1. Проверка безопасности: пользователь должен быть авторизован
    const response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: any) {
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: any) {
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Предотвращаем directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return new NextResponse('Invalid filename', { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'public', filename)

    if (!fs.existsSync(filePath)) {
        return new NextResponse('File not found', { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': 'application/gzip',
        },
    })
}
