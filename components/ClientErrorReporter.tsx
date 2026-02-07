'use client'

import { useEffect, useRef } from 'react'
import { CLIENT_ERROR_EVENT } from '@/lib/client-error'

type ClientErrorPayload = {
    type: 'error' | 'unhandledrejection'
    message: string
    stack?: string
    source?: string
    line?: number
    column?: number
    url?: string
    userAgent?: string
}

const MAX_MESSAGE_LEN = 2000
const MAX_STACK_LEN = 4000
const DEDUPE_WINDOW_MS = 10000
const MAX_DEDUPE_KEYS = 50
const HYDRATION_PATTERNS = [
    /Hydration failed because the server rendered HTML didn't match the client/i,
    /didn't match the client/i
]

function truncate(value: string | undefined, max: number) {
    if (!value) return value
    return value.length > max ? value.slice(0, max) + '…' : value
}

function safeStringify(value: unknown) {
    try {
        return JSON.stringify(value)
    } catch {
        return '[unserializable]'
    }
}

function isHydrationConsoleError(args: unknown[]) {
    for (const arg of args) {
        if (typeof arg === 'string') {
            if (HYDRATION_PATTERNS.some((re) => re.test(arg))) return true
        } else if (arg instanceof Error) {
            if (HYDRATION_PATTERNS.some((re) => re.test(arg.message))) return true
        }
    }
    return false
}

function getConsoleMessage(args: unknown[]) {
    const first = args.find((arg) => typeof arg === 'string') as string | undefined
    if (first) return first
    const err = args.find((arg) => arg instanceof Error) as Error | undefined
    if (err?.message) return err.message
    return 'Console error'
}

export function ClientErrorReporter() {
    const lastSentRef = useRef<Map<string, number>>(new Map())

    useEffect(() => {
        const shouldSend = (key: string) => {
            const now = Date.now()
            const last = lastSentRef.current.get(key)
            if (last && now - last < DEDUPE_WINDOW_MS) return false
            lastSentRef.current.set(key, now)
            if (lastSentRef.current.size > MAX_DEDUPE_KEYS) {
                const entries = Array.from(lastSentRef.current.entries())
                entries.sort((a, b) => a[1] - b[1])
                const toRemove = entries.slice(0, entries.length - MAX_DEDUPE_KEYS)
                toRemove.forEach(([k]) => lastSentRef.current.delete(k))
            }
            return true
        }

        const send = async (payload: ClientErrorPayload) => {
            try {
                await fetch('/api/log-client-error', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
            } catch {
                // Intentionally ignore to avoid recursive error reporting
            }
        }

        const onError = (event: ErrorEvent) => {
            const message = event.message || 'Unknown error'
            const payload: ClientErrorPayload = {
                type: 'error',
                message: truncate(message, MAX_MESSAGE_LEN) || 'Unknown error',
                stack: truncate(event.error?.stack, MAX_STACK_LEN),
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                url: typeof window !== 'undefined' ? window.location.href : undefined,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
            }

            const key = `${payload.type}|${payload.message}|${payload.source}|${payload.line}|${payload.column}`
            if (shouldSend(key)) void send(payload)
        }

        const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason
            const message =
                reason instanceof Error
                    ? reason.message
                    : typeof reason === 'string'
                        ? reason
                        : safeStringify(reason)

            const payload: ClientErrorPayload = {
                type: 'unhandledrejection',
                message: truncate(message, MAX_MESSAGE_LEN) || 'Unhandled rejection',
                stack: truncate(reason instanceof Error ? reason.stack : undefined, MAX_STACK_LEN),
                url: typeof window !== 'undefined' ? window.location.href : undefined,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
            }

            const key = `${payload.type}|${payload.message}`
            if (shouldSend(key)) void send(payload)
        }

        const onCustomReport = (event: Event) => {
            const detail = (event as CustomEvent).detail as Partial<ClientErrorPayload> | undefined
            if (!detail?.message) return
            const payload: ClientErrorPayload = {
                type: detail.type || 'error',
                message: truncate(detail.message, MAX_MESSAGE_LEN) || 'Unknown error',
                stack: truncate(detail.stack, MAX_STACK_LEN),
                source: detail.source,
                line: detail.line,
                column: detail.column,
                url: detail.url || (typeof window !== 'undefined' ? window.location.href : undefined),
                userAgent: detail.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined)
            }
            const key = `${payload.type}|${payload.message}|${payload.source || ''}|${payload.line || ''}|${payload.column || ''}`
            if (shouldSend(key)) void send(payload)
        }

        const originalConsoleError = console.error
        const consoleErrorWrapper = (...args: unknown[]) => {
            originalConsoleError(...args as any)
            if (!isHydrationConsoleError(args)) return
            const message = getConsoleMessage(args)
            const payload: ClientErrorPayload = {
                type: 'error',
                message: truncate(message, MAX_MESSAGE_LEN) || 'Hydration error',
                source: 'console.error',
                url: typeof window !== 'undefined' ? window.location.href : undefined,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
            }
            const key = `console|${payload.message}|${payload.url || ''}`
            if (shouldSend(key)) void send(payload)
        }

        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onRejection)
        window.addEventListener(CLIENT_ERROR_EVENT, onCustomReport as EventListener)
        console.error = consoleErrorWrapper as typeof console.error

        return () => {
            window.removeEventListener('error', onError)
            window.removeEventListener('unhandledrejection', onRejection)
            window.removeEventListener(CLIENT_ERROR_EVENT, onCustomReport as EventListener)
            console.error = originalConsoleError
        }
    }, [])

    return null
}
