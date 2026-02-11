'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSystemPrompts, updateSystemPrompt } from '@/app/actions/prompt-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { toast } from 'sonner'
import { Save, RefreshCw, Terminal, Settings2, Check, ChevronsUpDown, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getModelsForProvider } from '@/app/actions/ai-config-actions'

type SystemPrompt = {
    id: number
    key: string
    content: string
    description: string
    category: string
    provider?: string | null
    model?: string | null
    temperature?: number | null
}

const PROVIDERS = [
    { value: 'global', label: 'Глобальный по умолчанию' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'custom', label: 'Свой Endpoint' },
]

export function SystemPromptsEditor() {
    const [prompts, setPrompts] = useState<SystemPrompt[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<number | null>(null)
    const [originalPrompts, setOriginalPrompts] = useState<Record<number, SystemPrompt>>({})

    // Models Cache: provider -> list of models
    const [modelsCache, setModelsCache] = useState<Record<string, string[]>>({})
    const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({})
    const [openCombobox, setOpenCombobox] = useState<Record<number, boolean>>({})

    const fetchPrompts = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getSystemPrompts()
            if (!result.success) throw new Error(result.error)

            const typedData = (result.data as any[]).map(p => ({
                ...p,
                provider: p.provider || 'global', // Normalize null to 'global' for UI
                model: p.model || '',
                temperature: p.temperature ?? 0.7
            }))

            setPrompts(typedData)

            // Store original state deep copy for dirty checking
            const originals: Record<number, SystemPrompt> = {}
            typedData.forEach(p => originals[p.id] = { ...p })
            setOriginalPrompts(originals)

        } catch (e: any) {
            console.error(e)
            toast.error('Не удалось загрузить промпты')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPrompts()
    }, [fetchPrompts])

    const fetchModels = async (provider: string) => {
        if (!provider || provider === 'global') return
        if (modelsCache[provider] || fetchingModels[provider]) return

        setFetchingModels(prev => ({ ...prev, [provider]: true }))
        try {
            const models = await getModelsForProvider(provider)
            if (models && models.length > 0) {
                setModelsCache(prev => ({ ...prev, [provider]: models }))
            } else {
                setModelsCache(prev => ({ ...prev, [provider]: [] }))
            }
        } catch (e) {
            console.error(e)
            toast.error(`Не удалось получить модели для ${provider}`)
        } finally {
            setFetchingModels(prev => ({ ...prev, [provider]: false }))
        }
    }

    const handleUpdate = (id: number, field: keyof SystemPrompt, value: any) => {
        if (field === 'provider') {
            if (value !== 'global' && value !== 'custom') {
                fetchModels(value)
            }
            setPrompts(prev => prev.map(p => p.id === id ? { ...p, provider: value, model: '' } : p))
        } else {
            setPrompts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
        }
    }

    const isDirty = (current: SystemPrompt) => {
        const original = originalPrompts[current.id]
        if (!original) return false
        return (
            current.content !== original.content ||
            current.provider !== original.provider ||
            current.model !== original.model ||
            current.temperature !== original.temperature
        )
    }

    const handleSave = async (prompt: SystemPrompt) => {
        setSavingId(prompt.id)
        try {
            const payload = {
                content: prompt.content,
                provider: prompt.provider === 'global' ? null : prompt.provider,
                model: prompt.provider === 'global' ? null : prompt.model,
                temperature: prompt.temperature
            }

            const result = await updateSystemPrompt(prompt.id, payload)
            if (!result.success) throw new Error(result.error)

            setOriginalPrompts(prev => ({ ...prev, [prompt.id]: { ...prompt } }))
            toast.success(`Промпт "${prompt.key}" обновлен`)
        } catch (e: any) {
            console.error(e)
            toast.error(`Ошибка обновления промпта: ${e.message}`)
        } finally {
            setSavingId(null)
        }
    }

    const groupedPrompts = prompts.reduce((acc, prompt) => {
        const cat = prompt.category || 'Uncategorized'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(prompt)
        return acc
    }, {} as Record<string, SystemPrompt[]>)

    if (loading && prompts.length === 0) {
        return <div className="p-4 text-center text-muted-foreground animate-pulse">Загрузка промптов...</div>
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-2 border-border/50 pb-8">
                <div className="space-y-2">
                    <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Системные Промпты</h2>
                    <p className="text-base font-medium text-muted-foreground">
                        Управление инструкциями, логикой и поведением AI агентов.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="lg"
                    onClick={fetchPrompts}
                    disabled={loading}
                    className="h-12 px-6 rounded-2xl border-2 hover:bg-muted font-bold gap-3 transition-all active:scale-95"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Обновить данные
                </Button>
            </div>

            {Object.entries(groupedPrompts).map(([category, items]) => (
                <div key={category} className="space-y-6">
                    <h3 className="text-sm font-black text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-3 pl-2">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full" />
                        {category}
                    </h3>
                    <div className="grid gap-8">
                        {items.map(prompt => {
                            const dirty = isDirty(prompt)
                            const provider = prompt.provider || 'global'
                            const models = modelsCache[provider] || []
                            const isCustom = provider === 'custom'
                            const isGlobal = provider === 'global'

                            return (
                                <Card key={prompt.id} className="overflow-hidden border-2 border-border/50 shadow-xl rounded-[2rem] bg-background relative group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity duration-500" />
                                    <CardHeader className="pb-6 pt-8 px-8 bg-muted/20 border-b-2 border-border/50">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-1.5">
                                                <CardTitle className="text-xl font-black font-mono flex items-center gap-3 tracking-tight">
                                                    {prompt.key}
                                                    {dirty && (
                                                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 text-[10px] font-black uppercase tracking-widest animate-pulse px-2 h-6">
                                                            Изменено
                                                        </Badge>
                                                    )}
                                                </CardTitle>
                                                <CardDescription className="text-sm font-medium leading-relaxed">
                                                    {prompt.description || "Конфигурация поведения нейросети для данного модуля."}
                                                </CardDescription>
                                            </div>
                                            <Badge className="font-black text-[9px] bg-slate-100 dark:bg-slate-900 text-slate-500 border-2 uppercase tracking-widest px-3 py-1 rounded-lg">{prompt.category}</Badge>
                                        </div>
                                    </CardHeader>

                                    {/* Configuration Toolbar */}
                                    <div className="px-8 py-4 bg-muted/10 border-b-2 border-border/50 flex flex-col md:flex-row md:items-center gap-6">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 shrink-0">
                                            <Settings2 className="w-4 h-4" />
                                            <span>Конфигурация</span>
                                        </div>

                                        <div className="flex flex-1 flex-wrap items-center gap-4">
                                            {/* Provider Selector */}
                                            <div className="w-[180px] shrink-0">
                                                <Select
                                                    value={provider}
                                                    onValueChange={(val) => handleUpdate(prompt.id, 'provider', val)}
                                                >
                                                    <SelectTrigger className="h-10 rounded-xl border-2 bg-background/50 font-bold text-xs shadow-sm transition-all focus:ring-emerald-500/20">
                                                        <SelectValue placeholder="Провайдер" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-2 shadow-2xl">
                                                        {PROVIDERS.map(p => (
                                                            <SelectItem key={p.value} value={p.value} className="text-xs font-bold rounded-lg m-1">
                                                                {p.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Model Selector */}
                                            <div className="flex-1 min-w-[220px]">
                                                {isGlobal ? (
                                                    <div className="h-10 px-4 rounded-xl border-2 border-dashed flex items-center gap-2 bg-muted/10 text-muted-foreground/50 text-xs font-black uppercase tracking-widest">
                                                        <Bot className="w-3.5 h-3.5" />
                                                        Глобальная модель
                                                    </div>
                                                ) : isCustom ? (
                                                    <div className="relative">
                                                        <Terminal className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-30" />
                                                        <Input
                                                            value={prompt.model || ''}
                                                            onChange={(e) => handleUpdate(prompt.id, 'model', e.target.value)}
                                                            className="h-10 pl-10 rounded-xl border-2 bg-background/50 font-mono text-xs shadow-sm focus:ring-emerald-500/20"
                                                            placeholder="Endpoint Model ID"
                                                        />
                                                    </div>
                                                ) : (
                                                    <Popover
                                                        open={openCombobox[prompt.id]}
                                                        onOpenChange={(open) => {
                                                            setOpenCombobox(prev => ({ ...prev, [prompt.id]: open }))
                                                            if (open && (!models || models.length === 0)) {
                                                                fetchModels(provider)
                                                            }
                                                        }}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                className="w-full h-10 px-4 rounded-xl border-2 bg-background/50 font-bold text-xs shadow-sm justify-between transition-all"
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <Bot className="w-4 h-4 opacity-40" />
                                                                    {prompt.model ? prompt.model : "Выбрать модель..."}
                                                                </div>
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[350px] p-2 rounded-2xl border-2 shadow-2xl" align="start">
                                                            <Command className="rounded-xl overflow-hidden">
                                                                <CommandInput placeholder="Поиск в реестре моделей..." className="h-10 text-xs" />
                                                                <CommandList className="max-h-[300px]">
                                                                    <CommandEmpty className="py-6 text-center">
                                                                        {fetchingModels[provider] ? (
                                                                            <div className="flex flex-col items-center gap-3">
                                                                                <RefreshCw className="h-6 w-6 animate-spin text-emerald-500/50" />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Загрузка реестра...</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-xs font-bold text-muted-foreground">Модели не обнаружены</span>
                                                                        )}
                                                                    </CommandEmpty>
                                                                    <CommandGroup>
                                                                        {models.map((model) => (
                                                                            <CommandItem
                                                                                key={model}
                                                                                value={model}
                                                                                onSelect={(currentValue: string) => {
                                                                                    handleUpdate(prompt.id, 'model', currentValue)
                                                                                    setOpenCombobox(prev => ({ ...prev, [prompt.id]: false }))
                                                                                }}
                                                                                className="text-xs font-bold rounded-lg m-1 cursor-pointer"
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4 text-emerald-500",
                                                                                        prompt.model === model ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {model}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </div>

                                            {/* Temperature */}
                                            <div className="w-[100px] shrink-0">
                                                <div className="relative group/temp">
                                                    <span className="absolute left-3 top-2.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Temp</span>
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        max="2"
                                                        value={prompt.temperature ?? 0.7}
                                                        onChange={(e) => handleUpdate(prompt.id, 'temperature', parseFloat(e.target.value))}
                                                        className="h-10 text-center rounded-xl border-2 bg-background/50 font-black text-xs shadow-sm transition-all focus:ring-emerald-500/20 pl-10"
                                                        disabled={isGlobal}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <CardContent className="p-8 pt-6">
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 pl-1">Инструкция (System Prompt)</Label>
                                            <Textarea
                                                value={prompt.content}
                                                onChange={(e) => handleUpdate(prompt.id, 'content', e.target.value)}
                                                className="min-h-[200px] font-mono text-sm leading-relaxed resize-y bg-slate-500/[0.03] dark:bg-slate-100/[0.03] border-2 border-border/40 rounded-2xl p-6 focus:bg-background transition-all duration-300 shadow-inner"
                                                spellCheck={false}
                                            />
                                        </div>
                                    </CardContent>
                                    <div className={cn(
                                        "bg-muted/30 border-t-2 border-border/50 py-4 px-8 flex justify-end transition-all duration-500",
                                        dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                                    )}>
                                        <Button
                                            size="lg"
                                            onClick={() => handleSave(prompt)}
                                            disabled={savingId === prompt.id}
                                            className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/20 font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 gap-3"
                                        >
                                            {savingId === prompt.id ? (
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Save className="w-5 h-5" />
                                            )}
                                            Сохранить изменения
                                        </Button>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
