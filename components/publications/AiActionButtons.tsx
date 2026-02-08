import React from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sparkles, Settings2, Loader2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiActionButtonsProps {
    onGenerate: () => void
    onEditPrompt: () => void
    onMagicEdit?: () => void
    isGenerating: boolean
    className?: string
}


export function AiActionButtons({ onGenerate, onEditPrompt, onMagicEdit, isGenerating, className }: AiActionButtonsProps) {
    const [loadingMessage, setLoadingMessage] = React.useState("Думаю...")

    React.useEffect(() => {
        if (isGenerating) {
            const MESSAGES = [
                "Думаю...", "Пишу...", "Сочиняю...", "Креативлю...", "Анализирую...",
                "Магия...", "Колдую...", "Синтезирую...", "Вдохновляюсь...", "Рожаю шедевр..."
            ]
            let i = 0
            const interval = setInterval(() => {
                i = (i + 1) % MESSAGES.length
                setLoadingMessage(MESSAGES[i])
            }, 2000)
            return () => clearInterval(interval)
        }
    }, [isGenerating])

    return (
        <TooltipProvider delayDuration={300}>
            <div className={cn("flex items-center gap-1", className)}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onEditPrompt}
                            className="h-7 w-7 p-0 rounded-full hover:bg-muted text-muted-foreground"
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Редактировать промпт</TooltipContent>
                </Tooltip>

                {onMagicEdit && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onMagicEdit}
                                className="h-7 gap-1.5 px-2.5 text-xs font-medium bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300"
                            >
                                <Wand2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Magic Edit</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">AI Редактор (Magic Edit)</TooltipContent>
                    </Tooltip>
                )}

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onGenerate}
                            disabled={isGenerating}
                            className="h-7 gap-1.5 px-2.5 text-xs font-medium bg-background/50 hover:bg-background border-dashed"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span className="hidden sm:inline text-xs text-muted-foreground animate-pulse min-w-[60px] text-left">
                                        {loadingMessage}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="hidden sm:inline">AI</span>
                                </>
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Сгенерировать с помощью AI</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    )
}
