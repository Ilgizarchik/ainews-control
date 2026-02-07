'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bot, Server, RefreshCw, Network, Info, FileText, Save, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import type { AIConfig, ApiKeys } from '@/components/settings/types'

interface AIConfigTabProps {
    PROVIDERS: any[]
    config: AIConfig
    setConfig: React.Dispatch<React.SetStateAction<AIConfig>>
    apiKeys: ApiKeys
    setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>
    availableModels: string[]
    availableImageModels: string[]
    setAvailableModels: (models: string[]) => void
    setAvailableImageModels: (models: string[]) => void
    fetchingModels: boolean
    setFetchingModels: (v: boolean) => void
    loading: boolean
    saving: boolean
    handleSave: () => void
    handleProviderChange: (val: string) => void
    handleResetUrl: () => void
    showKeys: Record<string, boolean>
    toggleKeyVisibility: (keyName: string) => void
    updateSingleSetting: (key: string, value: string) => Promise<void>
}

export function AIConfigTab({
    PROVIDERS,
    config,
    setConfig,
    apiKeys,
    setApiKeys,
    availableModels,
    availableImageModels,
    setAvailableModels,
    setAvailableImageModels,
    fetchingModels,
    setFetchingModels,
    loading,
    saving,
    handleSave,
    handleProviderChange,
    handleResetUrl,
    showKeys,
    toggleKeyVisibility,
    updateSingleSetting: _updateSingleSetting
}: AIConfigTabProps) {

    const fetchModels = async (baseUrl: string, apiKey: string, provider: string, proxyUrl?: string) => {
        if (!baseUrl) {
            toast.error('Base URL is required to fetch models')
            return
        }
        setFetchingModels(true)
        try {
            const res = await fetch('/api/ai/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseUrl, apiKey, provider, proxyUrl })
            })
            const data = await res.json()
            let backendModels: string[] = []
            if (data.data && Array.isArray(data.data)) {
                backendModels = data.data.map((m: any) => m.id || m.model_name || m.name).filter(Boolean)
            } else if (Array.isArray(data)) {
                backendModels = data.map((m: any) => typeof m === 'string' ? m : (m.id || m.name)).filter(Boolean)
            } else if (data.models && Array.isArray(data.models)) {
                backendModels = data.models.map((m: any) => m.id || m.name).filter(Boolean)
            }

            backendModels.sort()
            setAvailableModels(backendModels)
            if (backendModels.length > 0) toast.success(`Загружено ${backendModels.length} моделей`)
            else toast.info('Модели не найдены')
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setFetchingModels(false)
        }
    }

    const handleFetchImageModels = async () => {
        const prov = config.imageProvider === 'global' ? config.provider : config.imageProvider;
        const url = (config.imageProvider === 'global' || !config.imageProvider) ? config.baseUrl : (PROVIDERS.find(p => p.value === prov)?.defaultUrl || '');
        const key = apiKeys[prov]

        if (!url) return toast.error('No URL for image provider');

        setFetchingModels(true);
        try {
            const res = await fetch('/api/ai/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseUrl: url,
                    apiKey: key,
                    provider: prov,
                    proxyUrl: (config.useProxy) ? config.proxyUrl : undefined
                })
            });
            const data = await res.json();
            let backendModels: string[] = [];
            if (data.data && Array.isArray(data.data)) {
                backendModels = data.data.map((m: any) => m.id || m.model_name || m.name).filter(Boolean)
            } else if (Array.isArray(data)) {
                backendModels = data.map((m: any) => typeof m === 'string' ? m : (m.id || m.name)).filter(Boolean)
            } else if (data.models && Array.isArray(data.models)) {
                backendModels = data.models.map((m: any) => m.id || m.name).filter(Boolean)
            }
            backendModels.sort();
            setAvailableImageModels(backendModels);
            if (backendModels.length > 0) toast.success(`Загружено ${backendModels.length} моделей`);
            else toast.info('Модели не найдены');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setFetchingModels(false);
        }
    }

    return (
        <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* API Keys */}
            <Card data-tutorial="settings-ai-keys" className="border-2 border-border/50 shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b-2 border-border/50 pb-6">
                    <CardTitle className="flex items-center gap-3 text-xl font-black">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                            <Save className="w-5 h-5 text-white" />
                        </div>
                        Ключи API
                    </CardTitle>
                    <CardDescription className="text-base font-medium">
                        Введите ключи доступа для провайдеров AI.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                    {PROVIDERS.map(p => (
                        <div key={p.value} className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{p.label} Key</Label>
                            <div className="relative">
                                <Input
                                    type={showKeys[p.value] ? "text" : "password"}
                                    value={apiKeys[p.value]}
                                    onChange={e => setApiKeys(prev => ({ ...prev, [p.value]: e.target.value }))}
                                    className="pr-12 font-mono text-sm h-12 rounded-xl border-2 shadow-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
                                    placeholder={`sk-... (${p.value})`}
                                />
                                <button
                                    type="button"
                                    onClick={() => toggleKeyVisibility(p.value)}
                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                                >
                                    {showKeys[p.value] ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Global Defaults */}
            <Card data-tutorial="settings-ai-model" className="border-2 border-emerald-200 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-cyan-50/50 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-cyan-950/20 shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-emerald-100/50 via-teal-100/30 to-cyan-100/50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/40 border-b-2 border-emerald-200 dark:border-emerald-900/30 pb-6">
                    <CardTitle className="flex items-center gap-3 text-xl font-black">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        Основная модель по умолчанию
                    </CardTitle>
                    <CardDescription className="text-base font-medium">
                        Этот провайдер и модель будут использоваться, если в Промпте не заданы свои настройки.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                    {/* Provider Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Провайдер по умолчанию</Label>
                            <Select value={config.provider} onValueChange={handleProviderChange} disabled={loading}>
                                <SelectTrigger className="h-12 rounded-xl border-2 shadow-sm transition-all focus:ring-emerald-500/20 bg-background/50">
                                    <SelectValue placeholder="Выберите провайдера" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                    {PROVIDERS.map(p => (
                                        <SelectItem key={p.value} value={p.value} className="rounded-lg m-1 cursor-pointer">{p.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Base URL */}
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Base URL (Опционально)</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Server className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground opacity-50" />
                                    <Input
                                        value={config.baseUrl}
                                        onChange={e => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                                        className="pl-12 font-mono text-sm h-12 rounded-xl border-2 shadow-sm focus:ring-emerald-500/20 bg-background/50"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleResetUrl}
                                    title="Reset"
                                    className="h-12 w-12 rounded-xl border-2 hover:bg-muted transition-all"
                                >
                                    <RefreshCw className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Модель по умолчанию</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-[10px] font-black uppercase tracking-wider gap-2 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 transition-all"
                                onClick={() => fetchModels(config.baseUrl, apiKeys[config.provider], config.provider, config.useProxy ? config.proxyUrl : '')}
                                disabled={fetchingModels || !apiKeys[config.provider]}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${fetchingModels ? 'animate-spin' : ''}`} />
                                Обновить модели
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <Select
                                value={availableModels.includes(config.model) ? config.model : "custom_input"}
                                onValueChange={(val) => {
                                    if (val !== 'custom_input') setConfig(prev => ({ ...prev, model: val }))
                                }}
                                disabled={fetchingModels || (availableModels.length === 0 && !config.model)}
                            >
                                <SelectTrigger className="h-12 rounded-xl border-2 shadow-sm focus:ring-emerald-500/20 bg-background/50">
                                    <SelectValue placeholder={fetchingModels ? "Загрузка моделей..." : (config.model || "Выберите модель")} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] rounded-2xl border-2 shadow-2xl">
                                    <div className="p-2 space-y-1">
                                        {availableModels.map(m => (
                                            <SelectItem key={m} value={m} className="rounded-lg cursor-pointer">{m}</SelectItem>
                                        ))}
                                        <div className="h-px bg-border my-2 mx-1" />
                                        <SelectItem value="custom_input" className="rounded-lg cursor-pointer font-bold text-emerald-600">Свой ID модели...</SelectItem>
                                    </div>
                                </SelectContent>
                            </Select>

                            {(!availableModels.includes(config.model)) && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <Input
                                        value={config.model}
                                        onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                                        placeholder="e.g. deepseek/deepseek-r1"
                                        className="font-mono text-sm h-12 rounded-xl border-2 focus:ring-emerald-500/20 bg-background/50"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Proxy Settings */}
            <Card className="border-2 border-border/50 shadow-lg rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/10 transition-colors" />
                <CardHeader className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 dark:from-slate-950/30 dark:via-gray-950/30 dark:to-slate-950/30 border-b-2 border-border/50 pb-6 relative">
                    <CardTitle className="flex items-center gap-3 text-xl font-black">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                            <Network className="w-5 h-5 text-white" />
                        </div>
                        Сеть и Прокси
                    </CardTitle>
                    <CardDescription className="text-base font-medium">
                        Настройте прокси, если ваш регион блокирует доступ к AI провайдерам.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-8 relative">
                    <div className="flex items-center justify-between p-6 rounded-2xl bg-muted/30 border-2 border-border/50 transition-all hover:bg-muted/40">
                        <Label htmlFor="proxy-mode" className="flex flex-col gap-1.5 cursor-pointer">
                            <span className="text-sm font-black uppercase tracking-widest">Включить прокси</span>
                            <span className="font-medium text-xs text-muted-foreground italic">Работает только для серверных AI запросов.</span>
                        </Label>
                        <Switch
                            id="proxy-mode"
                            checked={config.useProxy}
                            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, useProxy: checked }))}
                            className="data-[state=checked]:bg-blue-500"
                        />
                    </div>

                    {config.useProxy && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500 bg-blue-50/50 dark:bg-blue-950/20 p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-900/30">
                            <Label className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">URL прокси</Label>
                            <Input
                                value={config.proxyUrl}
                                onChange={e => setConfig(prev => ({ ...prev, proxyUrl: e.target.value }))}
                                placeholder="http://user:password@host:port"
                                className="h-12 font-mono text-sm rounded-xl border-2 border-blue-200 dark:border-blue-900/50 bg-background/50 focus:ring-blue-500/20"
                            />
                            <div className="flex items-start gap-2 pt-1 opacity-70 italic">
                                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-muted-foreground font-medium">
                                    Поддержка HTTP/HTTPS. Убедитесь, что прокси поддерживает метод CONNECT.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Automation Settings */}
            <Card className="border-2 border-border/50 shadow-lg rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-orange-500/10 transition-colors" />
                <CardHeader className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 dark:from-slate-950/30 dark:via-gray-950/30 dark:to-slate-950/30 border-b-2 border-border/50 pb-6 relative">
                    <CardTitle className="flex items-center gap-3 text-xl font-black">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        Автоматизация
                    </CardTitle>
                    <CardDescription className="text-base font-medium">
                        Управление автоматическими действиями AI.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-8 relative">
                    <div className="flex items-center justify-between p-6 rounded-2xl bg-muted/30 border-2 border-border/50 transition-all hover:bg-muted/40">
                        <Label htmlFor="auto-social" className="flex flex-col gap-1.5 cursor-pointer">
                            <span className="text-sm font-black uppercase tracking-widest">Авто-генерация постов</span>
                            <span className="font-medium text-xs text-muted-foreground italic">
                                Если включено, посты для соцсетей будут создаваться автоматически сразу после одобрения новости.
                                <br />Если выключено — только черновик новости.
                            </span>
                        </Label>
                        <Switch
                            id="auto-social"
                            checked={config.autoGenerateSocial}
                            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoGenerateSocial: checked }))}
                            className="data-[state=checked]:bg-orange-500"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Image Generation Settings */}
            <Card className="border-2 border-border/50 shadow-lg rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-teal-500/10 transition-colors" />
                <CardHeader className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 dark:from-slate-950/30 dark:via-gray-950/30 dark:to-slate-950/30 border-b-2 border-border/50 pb-6 relative">
                    <CardTitle className="flex items-center gap-3 text-xl font-black">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        Генерация изображений
                    </CardTitle>
                    <CardDescription className="text-base font-medium">
                        Настройки модели для создания картинок к новостям.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8 relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Провайдер изображений</Label>
                            <Select
                                value={config.imageProvider || 'global'}
                                onValueChange={(val) => setConfig(prev => ({ ...prev, imageProvider: val }))}
                                disabled={loading}
                            >
                                <SelectTrigger className="h-12 rounded-xl border-2 shadow-sm focus:ring-emerald-500/20 bg-background/50">
                                    <SelectValue placeholder="Как основной" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                    <SelectItem value="global" className="rounded-lg m-1 cursor-pointer font-bold italic">Как основной (Global)</SelectItem>
                                    <div className="h-px bg-border my-1 mx-2" />
                                    {PROVIDERS.map(p => (
                                        <SelectItem key={p.value} value={p.value} className="rounded-lg m-1 cursor-pointer">{p.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3 font-semibold">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Модель изображений</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wider gap-2 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 transition-all"
                                    onClick={handleFetchImageModels}
                                    disabled={fetchingModels || config.imageProvider === 'global'}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${fetchingModels ? 'animate-spin' : ''}`} />
                                    Обновить
                                </Button>
                            </div>
                            <div className="space-y-3">
                                <Select
                                    value={availableImageModels.includes(config.imageModel) ? config.imageModel : "custom_input"}
                                    onValueChange={(val) => {
                                        if (val !== 'custom_input') setConfig(prev => ({ ...prev, imageModel: val }))
                                    }}
                                    disabled={fetchingModels || (availableImageModels.length === 0 && !config.imageModel)}
                                >
                                    <SelectTrigger className="h-12 rounded-xl border-2 shadow-sm focus:ring-emerald-500/20 bg-background/50">
                                        <SelectValue placeholder={config.imageModel || "Выберите модель"} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px] rounded-2xl border-2 shadow-2xl">
                                        <div className="p-2 space-y-1">
                                            {availableImageModels.map(m => (
                                                <SelectItem key={m} value={m} className="rounded-lg cursor-pointer">{m}</SelectItem>
                                            ))}
                                            <div className="h-px bg-border my-2 mx-1" />
                                            <SelectItem value="custom_input" className="rounded-lg cursor-pointer font-bold text-emerald-600">Свой ID модели...</SelectItem>
                                        </div>
                                    </SelectContent>
                                </Select>

                                {(!availableImageModels.includes(config.imageModel)) && (
                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                        <Input
                                            value={config.imageModel || ''}
                                            onChange={e => setConfig(prev => ({ ...prev, imageModel: e.target.value }))}
                                            placeholder="e.g. google/gemini-2.0-flash-exp"
                                            className="font-mono text-sm h-12 rounded-xl border-2 focus:ring-emerald-500/20 bg-background/50"
                                        />
                                    </div>
                                )}
                                <p className="text-[10px] text-muted-foreground italic pl-1 font-medium opacity-70">
                                    Оставьте пустым для авто-выбора (DALL-E 3 или Gemini Flash Image).
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t-2 border-border/50 px-8 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 italic">
                        <Info className="w-4 h-4" />
                        Настройки применяются немедленно
                    </div>
                    <Button
                        data-tutorial="settings-ai-save"
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="h-11 px-8 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/20 font-black text-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/30 gap-3"
                    >
                        {saving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Сохранить AI конфигурацию
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
