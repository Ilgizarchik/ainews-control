'use client'

import { toast as sonnerToast, ExternalToast } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, X, AlertCircle, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UndoToastProps {
    id: string | number
    message: string
    description?: string
    onUndo: () => void
    onCommit: () => void
    duration?: number
    type?: 'danger' | 'info'
}

export function UndoToast({
    id,
    message,
    description = "Действие будет применено...",
    onUndo,
    onCommit,
    duration = 5000,
    type = 'danger'
}: UndoToastProps) {
    const [progress, setProgress] = useState(100)
    const [seconds, setSeconds] = useState(Math.ceil(duration / 1000))
    const startTimeRef = useRef(0)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const commitedRef = useRef(false)

    useEffect(() => {
        startTimeRef.current = Date.now()
        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current
            const remainingPercent = Math.max(0, 100 - (elapsed / duration) * 100)
            const remainingSeconds = Math.ceil((duration - elapsed) / 1000)

            setProgress(remainingPercent)
            setSeconds(remainingSeconds)

            if (elapsed >= duration) {
                if (!commitedRef.current) {
                    commitedRef.current = true;
                    if (intervalRef.current) clearInterval(intervalRef.current)
                    onCommit()
                    sonnerToast.dismiss(id)
                }
            }
        }, 50)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [duration, id, onCommit])

    const handleCancel = () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        onUndo()
        sonnerToast.dismiss(id)
    }

    const radius = 12
    const circumference = 2 * Math.PI * radius
    const dashOffset = (p: number) => circumference - (p / 100) * circumference

    const colorClass = type === 'danger' ? 'stroke-rose-500' : 'stroke-blue-500'
    const bgColorClass = type === 'danger' ? 'bg-rose-500/5 group-hover:bg-rose-500/10' : 'bg-blue-500/5 group-hover:bg-blue-500/10'

    return (
        <div className="flex items-center gap-4 bg-zinc-900 text-white p-4 rounded-2xl shadow-2xl min-w-[320px] border border-zinc-800 animate-in slide-in-from-bottom-5 duration-300 relative overflow-hidden group">
            <div className={cn("absolute inset-0 transition-colors", bgColorClass)} />

            <div className="relative w-10 h-10 flex items-center justify-center shrink-0 z-10">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r={radius} fill="none" className="stroke-zinc-700" strokeWidth="3" />
                    <circle
                        cx="18"
                        cy="18"
                        r={radius}
                        fill="none"
                        className={cn("transition-all duration-100 ease-linear", colorClass)}
                        strokeWidth="3"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset(progress)}
                        strokeLinecap="round"
                    />
                </svg>
                <span className={cn("absolute text-[10px] font-bold font-mono", type === 'danger' ? 'text-rose-200' : 'text-blue-200')}>
                    {Math.max(0, seconds)}s
                </span>
            </div>

            <div className="flex flex-col flex-1 gap-0.5 z-10">
                <span className="font-bold text-sm text-zinc-100 flex items-center gap-2">{message}</span>
                <span className="text-[10px] text-zinc-400 font-medium">{description}</span>
            </div>

            <button
                onClick={handleCancel}
                className="z-10 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl text-xs font-bold transition-all border border-zinc-700/50 hover:border-zinc-500 hover:text-white text-zinc-300 shadow-sm"
            >
                Отмена
            </button>
        </div>
    )
}

function BaseToast({ title, description, icon: Icon, colorClass, bgClass, onClose }: any) {
    return (
        <div className={cn("flex items-center gap-3 bg-white dark:bg-zinc-950 border p-4 rounded-2xl shadow-2xl min-w-[300px] animate-in slide-in-from-bottom-5 fade-in duration-300", bgClass)}>
            <div className={cn("p-2 rounded-full", colorClass)}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground">{title}</span>
                {description && <span className="text-xs text-muted-foreground">{description}</span>}
            </div>
            {onClose && (
                <button onClick={onClose} className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}

export function showUndoToast(options: Omit<UndoToastProps, 'id'>) {
    sonnerToast.custom((t) => <UndoToast id={t} {...options} />, { duration: (options.duration || 5000) + 500 })
}

export function showSuccessToast(message: string, description?: string, id?: string | number) {
    return sonnerToast.custom((t) => (
        <BaseToast
            title={message}
            description={description}
            icon={CheckCircle2}
            colorClass="text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
            bgClass="border-emerald-200 dark:border-emerald-800 shadow-emerald-500/10"
            onClose={() => sonnerToast.dismiss(id || t)}
        />
    ), { duration: 4000, id })
}

export function showErrorToast(message: string, description?: string, id?: string | number) {
    return sonnerToast.custom((t) => (
        <BaseToast
            title={message}
            description={description}
            icon={AlertCircle}
            colorClass="text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30"
            bgClass="border-rose-200 dark:border-rose-800 shadow-rose-500/10"
            onClose={() => sonnerToast.dismiss(id || t)}
        />
    ), { duration: 6000, id })
}

export function showInfoToast(message: string, description?: string, id?: string | number) {
    return sonnerToast.custom((t) => (
        <BaseToast
            title={message}
            description={description}
            icon={Info}
            colorClass="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
            bgClass="border-blue-200 dark:border-blue-800 shadow-blue-500/10"
            onClose={() => sonnerToast.dismiss(id || t)}
        />
    ), { duration: 4000, id })
}

export function showLoadingToast(message: string, description?: string, id?: string | number) {
    return sonnerToast.custom((_t) => (
        <BaseToast
            title={message}
            description={description}
            icon={Loader2}
            colorClass="text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 animate-spin"
            bgClass="border-zinc-200 dark:border-zinc-800 shadow-xl"
        />
    ), { duration: Infinity, id })
}

// Unified toast function for compatibility
const toastFn = (message: string | React.ReactNode, data?: ExternalToast) => {
    return sonnerToast(message, data)
}

// Assign methods to the function object
Object.assign(toastFn, sonnerToast, {
    success: (message: string, data?: ExternalToast) => showSuccessToast(message, data?.description as string, data?.id),
    error: (message: string, data?: ExternalToast) => showErrorToast(message, data?.description as string, data?.id),
    info: (message: string, data?: ExternalToast) => showInfoToast(message, data?.description as string, data?.id),
    loading: (message: string, data?: ExternalToast) => showLoadingToast(message, data?.description as string, data?.id),
})

export const toast = toastFn as typeof sonnerToast & {
    success: (message: string, data?: ExternalToast) => string | number;
    error: (message: string, data?: ExternalToast) => string | number;
    info: (message: string, data?: ExternalToast) => string | number;
    loading: (message: string, data?: ExternalToast) => string | number;
}
