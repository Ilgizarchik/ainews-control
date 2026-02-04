'use client'

import { cn } from "@/lib/utils"

interface LoadingDotsProps {
    className?: string
    dotClassName?: string
}

export function LoadingDots({ className, dotClassName }: LoadingDotsProps) {
    return (
        <div className={cn("flex items-center justify-center gap-1.5", className)}>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={cn(
                        "w-2.5 h-2.5 rounded-full bg-current",
                        "animate-premium-dot",
                        dotClassName
                    )}
                    style={{
                        animationDelay: `${i * 0.15}s`,
                    }}
                />
            ))}
        </div>
    )
}
