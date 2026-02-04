'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { toast } from 'sonner'
import { Save, RefreshCw, MessageSquare, Terminal, Settings2, Check, ChevronsUpDown } from 'lucide-react'
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
    const supabase = createClient()
    const [prompts, setPrompts] = useState<SystemPrompt[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<number | null>(null)
    const [originalPrompts, setOriginalPrompts] = useState<Record<number, SystemPrompt>>({})

    // Models Cache: provider -> list of models
    const [modelsCache, setModelsCache] = useState<Record<string, string[]>>({})
    const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({})
    const [openCombobox, setOpenCombobox] = useState<Record<number, boolean>>({})

    useEffect(() => {
        fetchPrompts()
    }, [])

    const fetchPrompts = async () => {
        setLoading(true)
        try {
            const { data, error } = await (supabase
                .from('system_prompts') as any)
                .select('*')
                .order('category', { ascending: true })
                .order('key', { ascending: true })

            if (error) throw error

            const typedData = (data as any[]).map(p => ({
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
    }

    const fetchModels = async (provider: string) => {
        if (!provider || provider === 'global') return
        if (modelsCache[provider] || fetchingModels[provider]) return

        setFetchingModels(prev => ({ ...prev, [provider]: true }))
        try {
            const models = await getModelsForProvider(provider)
            if (models && models.length > 0) {
                setModelsCache(prev => ({ ...prev, [provider]: models }))
                console.log(`Loaded ${models.length} models for ${provider}`)
            } else {
                // toast.warning(`No models found for ${provider}`)
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
        // If provider changed, fetch models and reset current model
        if (field === 'provider') {
            if (value !== 'global' && value !== 'custom') {
                fetchModels(value)
            }
            // Reset model when provider changes to prevent invalid model for provider
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
            // Prepared payload
            const payload = {
                content: prompt.content,
                provider: prompt.provider === 'global' ? null : prompt.provider, // Convert 'global' back to null
                model: prompt.provider === 'global' ? null : prompt.model, // Clear model if global
                temperature: prompt.temperature
            }

            const { error } = await (supabase
                .from('system_prompts') as any)
                .update(payload)
                .eq('id', prompt.id)

            if (error) throw error

            // Update original state to match current
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
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium">Системные Промпты</h2>
                    <p className="text-sm text-muted-foreground">
                        Управление инструкциями для AI агентов для различных задач.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchPrompts} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Обновить
                </Button>
            </div>

            {Object.entries(groupedPrompts).map(([category, items]) => (
                <div key={category} className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        {category === 'Dashboard' ? <Terminal className="w-4 h-4 text-emerald-500" /> : <MessageSquare className="w-4 h-4 text-emerald-500" />}
                        {category}
                    </h3>
                    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
                        {items.map(prompt => {
                            const dirty = isDirty(prompt)
                            const provider = prompt.provider || 'global'
                            const models = modelsCache[provider] || []
                            const isCustom = provider === 'custom'
                            const isGlobal = provider === 'global'
                            const isFetching = fetchingModels[provider]

                            return (
                                <Card key={prompt.id} className="overflow-hidden border-l-4 border-l-emerald-500/40">
                                    <CardHeader className="pb-3 bg-muted/50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-base font-mono flex items-center gap-2">
                                                    {prompt.key}
                                                    {dirty && <Badge className="text-xs h-5 px-1.5 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Изменено</Badge>}
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    {prompt.description || "Нет описания"}
                                                </CardDescription>
                                            </div>
                                            <Badge className="font-mono text-[10px] bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted">{prompt.category}</Badge>
                                        </div>
                                    </CardHeader>

                                    {/* Configuration Toolbar */}
                                    <div className="px-6 py-2 bg-muted/20 border-b flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                            <Settings2 className="w-3 h-3" />
                                            <span>Конфигурация Агента:</span>
                                        </div>

                                        <div className="flex flex-1 items-center gap-3 w-full">
                                            {/* Provider Selector */}
                                            <div className="w-[180px] shrink-0">
                                                <Select
                                                    value={provider}
                                                    onValueChange={(val) => handleUpdate(prompt.id, 'provider', val)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs bg-background">
                                                        <SelectValue placeholder="Провайдер" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PROVIDERS.map(p => (
                                                            <SelectItem key={p.value} value={p.value} className="text-xs">
                                                                {p.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Model Selector (Combobox) or Input */}
                                            <div className="flex-1 min-w-[200px]">
                                                {isGlobal ? (
                                                    <Input
                                                        disabled
                                                        value="Используется глобальная модель"
                                                        className="h-7 text-xs font-mono bg-muted/50 text-muted-foreground"
                                                    />
                                                ) : isCustom ? (
                                                    <Input
                                                        value={prompt.model || ''}
                                                        onChange={(e) => handleUpdate(prompt.id, 'model', e.target.value)}
                                                        className="h-7 text-xs font-mono bg-background"
                                                        placeholder="Свой ID Модели"
                                                    />
                                                ) : (
                                                    <Popover
                                                        open={openCombobox[prompt.id]}
                                                        onOpenChange={(open) => {
                                                            setOpenCombobox(prev => ({ ...prev, [prompt.id]: open }))
                                                            // Trigger fetch if empty and opening
                                                            if (open && (!models || models.length === 0)) {
                                                                fetchModels(provider)
                                                            }
                                                        }}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={openCombobox[prompt.id]}
                                                                className="w-full h-7 justify-between text-xs bg-background font-normal"
                                                            >
                                                                {prompt.model ? prompt.model : "Выберите модель..."}
                                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[350px] p-0" align="start">
                                                            <Command>
                                                                <CommandInput placeholder="Поиск моделей..." className="h-8 text-xs" />
                                                                <CommandList className="max-h-[300px]">
                                                                    <CommandEmpty>
                                                                        {fetchingModels[provider] ? 'Загрузка моделей...' : 'Модели не найдены.'}
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
                                                                                className="text-xs"
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-3 w-3",
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
                                            <div className="w-[80px] shrink-0" title="Temperature (0.0 - 2.0)">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground font-mono">T:</span>
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        max="2"
                                                        value={prompt.temperature ?? 0.7}
                                                        onChange={(e) => handleUpdate(prompt.id, 'temperature', parseFloat(e.target.value))}
                                                        className="h-7 text-xs font-mono bg-background pl-6 pr-1"
                                                        disabled={isGlobal}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <CardContent className="pt-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Системная инструкция (Промпт)</Label>
                                            <Textarea
                                                value={prompt.content}
                                                onChange={(e) => handleUpdate(prompt.id, 'content', e.target.value)}
                                                className="min-h-[150px] font-mono text-sm leading-relaxed resize-y bg-background"
                                                spellCheck={false}
                                            />
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-muted/30 border-t py-3 flex justify-end">
                                        {dirty && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSave(prompt)}
                                                disabled={savingId === prompt.id}
                                                className="transition-all"
                                            >
                                                {savingId === prompt.id ? (
                                                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                                ) : (
                                                    <Save className="w-3 h-3 mr-2" />
                                                )}
                                                Сохранить
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
