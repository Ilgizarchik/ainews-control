import { Send, Globe } from 'lucide-react'

// Custom icons for VK and OK since they aren't in Lucide standard set
export const VkIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M15.6 21.3c-6.6 0-10.4-4.5-10.5-12h3.3c.1 4.2 1.9 6 3.4 6.3V9.3h3.3v3.6c2-.2 4.1-2.5 4.8-5h3.1c-.6 2.5-2.2 4.4-3.5 5.2 1.3.6 3.3 2.1 4.1 5.2h-3.4c-.9-2.2-2.5-3.8-4.9-4v3.9h-.7z" /></svg>
)

export const OkIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M12 12.3c-1.6 0-3.3 0-3.8-1.7 0 0-.4-1.6 1.9-1.6 2.3 0 1.9 1.6 1.9 1.6.5 1.7-1.2 1.7-2.8 1.7zm0-6.8c1.6 0 2.9 1.3 2.9 2.9S13.6 11.3 12 11.3s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9zm5 11c1.3 0 1.7-1.8 1.7-1.8.3-1.3-1.4-1.3-1.4-1.3-2.3 0-3.9 0-5.3-.1-1.4.1-3 .1-5.3.1 0 0-1.7 0-1.4 1.3 0 0 .4 1.8 1.7 1.8 1.1 0 2.9 0 4.1-.1l-2.6 2.6c0 0-1.1 1.2.2 2.3.8.7 2.1-.5 2.1-.5l2.8-3 2.8 3c0 0 1.3 1.2 2.1.5 1.3-1.1.2-2.3.2-2.3l-2.6-2.6c1.2.1 3 .1 4.1.1z" /></svg>
)

export type PlatformType = 'tg' | 'vk' | 'ok' | 'site'

export const PLATFORM_CONFIG: Record<string, {
    label: string
    icon: any
    color: string
    bgColor: string
    borderColor: string
    ringColor: string
}> = {
    tg: {
        label: 'Telegram',
        icon: Send,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-200 dark:border-blue-800',
        ringColor: 'ring-blue-500'
    },
    vk: {
        label: 'VK',
        icon: VkIcon,
        color: 'text-[#0077FF]',
        bgColor: 'bg-[#0077FF]/10',
        borderColor: 'border-[#0077FF]/30',
        ringColor: 'ring-[#0077FF]'
    },
    ok: {
        label: 'OK',
        icon: OkIcon,
        color: 'text-[#F97400]',
        bgColor: 'bg-[#F97400]/10',
        borderColor: 'border-[#F97400]/30',
        ringColor: 'ring-[#F97400]'
    },
    site: {
        label: 'Website',
        icon: Globe,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        ringColor: 'ring-emerald-500'
    }
}

export const getPlatformConfig = (code: string) => {
    return PLATFORM_CONFIG[code?.toLowerCase()] || {
        label: code,
        icon: Globe,
        color: 'text-zinc-500',
        bgColor: 'bg-zinc-100 dark:bg-zinc-800',
        borderColor: 'border-zinc-200 dark:border-zinc-700',
        ringColor: 'ring-zinc-500'
    }
}
