import { NextRequest, NextResponse } from 'next/server'
import { logErrorToTelegram } from '@/lib/logger-service'

type ClientErrorPayload = {
    type?: 'error' | 'unhandledrejection'
    message?: string
    stack?: string
    source?: string
    line?: number
    column?: number
    url?: string
    userAgent?: string
}

const MAX_FIELD_LEN = 4000

function sanitize(value?: string) {
    if (!value) return ''
    return value.length > MAX_FIELD_LEN ? value.slice(0, MAX_FIELD_LEN) + '…' : value
}

function isAllowedOrigin(request: NextRequest) {
    const origin = request.headers.get('origin') || ''
    const host = request.headers.get('host') || ''
    const allowed = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL

    if (!origin) return true
    if (allowed && origin.startsWith(allowed)) return true
    if (host && origin.includes(host)) return true

    return false
}

export async function POST(request: NextRequest) {
    try {
        if (!isAllowedOrigin(request)) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 })
        }

        const payload = (await request.json()) as ClientErrorPayload

        const type = payload.type || 'error'
        const message = sanitize(payload.message) || 'Unknown client error'
        const stack = sanitize(payload.stack)
        const source = sanitize(payload.source)
        const url = sanitize(payload.url)
        const userAgent = sanitize(payload.userAgent)
        const line = payload.line
        const column = payload.column

        const details = [
            `Type: ${type}`,
            url ? `URL: ${url}` : null,
            source ? `Source: ${source}` : null,
            typeof line === 'number' ? `Line: ${line}` : null,
            typeof column === 'number' ? `Column: ${column}` : null,
            userAgent ? `UA: ${userAgent}` : null,
            stack ? `Stack: ${stack}` : null
        ]
            .filter(Boolean)
            .join('\n')

        const errorText = `${message}\n\n${details}`

        await logErrorToTelegram(errorText, `client:${type}`)

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
    }
}

