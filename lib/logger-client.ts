'use client'

export function logSystemEvent(
    message: string,
    type: 'info' | 'success' | 'wait' | 'error' | 'thinking' = 'info'
) {
    if (typeof window !== 'undefined') {
        const event = new CustomEvent('witty-log', {
            detail: { text: message, type }
        })
        window.dispatchEvent(event)
    }
}

export function getRandomPhrase(phrases: string[]) {
    return phrases[Math.floor(Math.random() * phrases.length)]
}

export const SOCIAL_GEN_PHRASES = [
    "Пишу посты для соцсетей... 📱",
    "Адаптирую контент под Telegram и VK...",
    "Накидываю хэштеги и смайлики... #️⃣",
    "Разливаю контент по платформам..."
]
