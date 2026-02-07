'use client'

type ClientErrorPayload = {
    type?: 'error' | 'unhandledrejection'
    message: string
    stack?: string
    source?: string
    line?: number
    column?: number
    url?: string
    userAgent?: string
}

const EVENT_NAME = 'client-error-report'

export function reportClientError(payload: ClientErrorPayload) {
    if (typeof window === 'undefined') return
    try {
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }))
    } catch {
        // Ignore: error reporting must never throw
    }
}

export const CLIENT_ERROR_EVENT = EVENT_NAME
