'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { startTutorial } from './TutorialProvider'
import { resetTutorial } from '@/lib/tutorial/tutorial-config'
import { cn } from '@/lib/utils'
import { type DriveStep } from 'driver.js'

interface TutorialButtonProps {
    className?: string;
    variant?: "ghost" | "outline" | "secondary" | "default";
    steps?: DriveStep[];
    label?: string;
    children?: React.ReactNode;
}

/**
 * Кнопка для запуска/перезапуска туториала в виде знака вопроса
 */
export function TutorialButton({ className, variant = "ghost", steps, label, children }: TutorialButtonProps) {
    const handleClick = () => {
        resetTutorial()
        startTutorial(steps)
    }

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={variant}
                        size={label || children ? "default" : "icon"}
                        onClick={handleClick}
                        className={cn(
                            "rounded-full transition-all duration-300",
                            !(label || children) && "h-9 w-9",
                            "hover:bg-emerald-500/10 hover:text-emerald-500 hover:scale-105 active:scale-95",
                            className
                        )}
                        data-tutorial="help-button"
                    >
                        <HelpCircle className="w-5 h-5 flex-shrink-0" />
                        {label && <span className="font-bold text-xs uppercase tracking-wider">{label}</span>}
                        {children}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p className="font-semibold">Интерактивный туториал</p>
                    <p className="text-xs opacity-80">Помощь по разделу</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
