'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startTutorial } from '@/components/tutorial/TutorialProvider'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface HelpButtonProps {
    className?: string
    variant?: 'ghost' | 'outline' | 'secondary' | 'default'
    size?: 'icon' | 'default' | 'sm' | 'lg'
}

export function HelpButton({
    className,
    variant = 'ghost',
    size = 'icon'
}: HelpButtonProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={variant}
                        size={size}
                        onClick={() => startTutorial()}
                        className={cn(
                            "rounded-full transition-all duration-300 hover:scale-110 active:scale-95",
                            "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10",
                            className
                        )}
                        data-tutorial="help-button"
                    >
                        <HelpCircle className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p>Обучение и подсказки</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
