import { logger } from '@/lib/logger'

export async function register() {
    const runtime = process.env.NEXT_RUNTIME
    logger.info(`[Instrumentation] Runtime ${runtime} registered. Waiting for external triggers (API).`)

    if (runtime === 'nodejs') {
        // Здесь можно инициализировать только критические серверные ресурсы,
        // но НЕ запускать фоновые циклы, которые дублируют крон.
    }

    if (runtime === 'edge') {
        logger.info('[Instrumentation] Edge Runtime ready.')
    }
}
