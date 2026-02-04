import { Send, Globe } from 'lucide-react'

// Custom icons for VK and OK since they aren't in Lucide standard set
export const VkIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M15.6 21.3c-6.6 0-10.4-4.5-10.5-12h3.3c.1 4.2 1.9 6 3.4 6.3V9.3h3.3v3.6c2-.2 4.1-2.5 4.8-5h3.1c-.6 2.5-2.2 4.4-3.5 5.2 1.3.6 3.3 2.1 4.1 5.2h-3.4c-.9-2.2-2.5-3.8-4.9-4v3.9h-.7z" /></svg>
)

export const OkIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M12 12.3c-1.6 0-3.3 0-3.8-1.7 0 0-.4-1.6 1.9-1.6 2.3 0 1.9 1.6 1.9 1.6.5 1.7-1.2 1.7-2.8 1.7zm0-6.8c1.6 0 2.9 1.3 2.9 2.9S13.6 11.3 12 11.3s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9zm5 11c1.3 0 1.7-1.8 1.7-1.8.3-1.3-1.4-1.3-1.4-1.3-2.3 0-3.9 0-5.3-.1-1.4.1-3 .1-5.3.1 0 0-1.7 0-1.4 1.3 0 0 .4 1.8 1.7 1.8 1.1 0 2.9 0 4.1-.1l-2.6 2.6c0 0-1.1 1.2.2 2.3.8.7 2.1-.5 2.1-.5l2.8-3 2.8 3c0 0 1.3 1.2 2.1.5 1.3-1.1.2-2.3.2-2.3l-2.6-2.6c1.2.1 3 .1 4.1.1z" /></svg>
)

export const ThreadsIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M12.27 4.07C16.56 4.07 19.33 6.64 19.33 10.93C19.33 14.85 17.58 16.96 15.34 16.96C13.69 16.96 12.8 15.68 12.8 14.23C12.8 11.41 15.13 9.76 17.26 9.76C17.47 9.76 17.66 9.78 17.85 9.8C17.75 7.44 16.03 5.76 12.32 5.76C8.24 5.76 5.39 9.04 5.39 13.79C5.39 18.75 8.35 21.57 12.56 21.57C14.56 21.57 16.19 20.96 17.44 20.19L18.16 21.68C16.67 22.69 14.67 23.25 12.53 23.25C7.23 23.25 3.52 19.55 3.52 13.79C3.52 7.91 7.41 4.07 12.27 4.07ZM17.18 11.38C16.06 11.38 14.67 12.1 14.67 14.18C14.67 15.06 15.04 15.49 15.55 15.49C16.35 15.49 17.29 14.53 17.29 12.45C17.29 12.1 17.26 11.73 17.18 11.38Z" /></svg>
)

export const XIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
)

export const FacebookIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.791 1.657-2.791 3.593v1.98h5.343l-.6 4.637h-4.743v7.981" /></svg>
)

export type PlatformType = 'tg' | 'vk' | 'ok' | 'site' | 'threads' | 'fb' | 'x'

export const PLATFORM_CONFIG: Record<string, {
    label: string
    icon: any
    color: string
    bgColor: string
    borderColor: string
    ringColor: string
    dotClass: string
    maxLength?: number
}> = {
    tg: {
        label: 'Telegram',
        icon: Send,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-200 dark:border-blue-800',
        ringColor: 'ring-blue-500',
        dotClass: 'bg-blue-500',
        maxLength: 4096
    },
    vk: {
        label: 'VK',
        icon: VkIcon,
        color: 'text-[#0077FF]',
        bgColor: 'bg-[#0077FF]/10',
        borderColor: 'border-[#0077FF]/30',
        ringColor: 'ring-[#0077FF]',
        dotClass: 'bg-[#0077FF]',
        maxLength: 14000
    },
    ok: {
        label: 'OK',
        icon: OkIcon,
        color: 'text-[#F97400]',
        bgColor: 'bg-[#F97400]/10',
        borderColor: 'border-[#F97400]/30',
        ringColor: 'ring-[#F97400]',
        dotClass: 'bg-[#F97400]',
        maxLength: 4000
    },
    site: {
        label: 'Website',
        icon: Globe,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        ringColor: 'ring-emerald-500',
        dotClass: 'bg-emerald-500',
    },
    threads: {
        label: 'Threads',
        icon: ThreadsIcon,
        color: 'text-black dark:text-white',
        bgColor: 'bg-zinc-500/10',
        borderColor: 'border-zinc-200 dark:border-zinc-700',
        ringColor: 'ring-zinc-500',
        dotClass: 'bg-black dark:bg-white',
        maxLength: 500
    },
    fb: {
        label: 'Facebook',
        icon: FacebookIcon,
        color: 'text-[#1877F2]',
        bgColor: 'bg-[#1877F2]/10',
        borderColor: 'border-[#1877F2]/30',
        ringColor: 'ring-[#1877F2]',
        dotClass: 'bg-[#1877F2]',
        maxLength: 60000
    },
    x: {
        label: 'X',
        icon: XIcon,
        color: 'text-black dark:text-white',
        bgColor: 'bg-zinc-500/10',
        borderColor: 'border-zinc-200 dark:border-zinc-700',
        ringColor: 'ring-zinc-500',
        dotClass: 'bg-black dark:bg-white',
        maxLength: 280
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
