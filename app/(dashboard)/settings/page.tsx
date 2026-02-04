'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Bot, Key, Server, Save, Eye, EyeOff, RefreshCw, Network,
    Send, Globe, Rss, FileText, Play, SwitchCamera, ExternalLink,
    Info, Trash2
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { LEGACY_SOURCES, IngestionSource } from '@/lib/ingestion/sources'
import { triggerIngestion } from '@/app/actions/ingest-actions'
import { getDbSources, deleteSource, toggleSourceActive } from '@/app/actions/scan-source-actions'
import { AddSourceDialog } from '@/components/ingestion/add-source-dialog'
import { SystemPromptsEditor } from '@/components/system-prompts-editor'

export default function SettingsPage() {
    const supabase = createClient()
    const [mounted, setMounted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [fetchingModels, setFetchingModels] = useState(false)

    // Visibility toggles for keys
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

    // Dynamic list of models fetched from API
    const [availableModels, setAvailableModels] = useState<string[]>([])

    // Global Defaults Configuration
    const [config, setConfig] = useState({
        provider: 'openrouter', // Default provider
        model: 'anthropic/claude-3.5-sonnet',
        baseUrl: 'https://openrouter.ai/api/v1',
        proxyUrl: '',
        useProxy: false
    })

    // Key Vault
    const [apiKeys, setApiKeys] = useState({
        openrouter: '',
        openai: '',
        anthropic: '',
        custom: '',
        // Integrations
        telegram_bot_token: '',
        publish_chat_id: '',
        tilda_cookies: '',
        tilda_project_id: '',
        tilda_feed_uid: '',
        vk_access_token: '',
        vk_owner_id: '',
        ok_public_key: '',
        ok_access_token: '',
        ok_app_secret: '',
        ok_group_id: '',
        fb_access_token: '',
        fb_page_id: '',
        th_access_token: '',
        th_user_id: '',
        twitter_auth_token: '',
        twitter_proxy_url: ''
    })

    const [telegramToken, setTelegramToken] = useState('')
    const [showTelegramToken, setShowTelegramToken] = useState(false)
    const [savingTelegram, setSavingTelegram] = useState(false)

    // Ingestion Config
    // Ingestion Config
    const [ingestionConfig, setIngestionConfig] = useState<Record<string, { isActive: boolean }>>({})
    const [ingestionRunning, setIngestionRunning] = useState(false)
    const [ingestSchedule, setIngestSchedule] = useState({
        mode: 'interval',
        value: '60',
        days: [] as string[]
    })
    const [dbSources, setDbSources] = useState<any[]>([])
    const [autoIngestion, setAutoIngestion] = useState(true)
    const [safePublishMode, setSafePublishMode] = useState(true)

    // Computed
    const allSources = React.useMemo(() => {
        const mappedDb = dbSources.map(s => ({
            id: s.id,
            name: s.name,
            url: s.url,
            type: s.type,
            isActive: s.is_active,
            icon: s.type === 'rss' ? 'rss' : 'globe',
            is_custom: true
        }))
        return [...LEGACY_SOURCES, ...mappedDb] as IngestionSource[]
    }, [dbSources])

    const PROVIDERS = [
        { value: 'openrouter', label: 'OpenRouter (Agregator)', defaultUrl: 'https://openrouter.ai/api/v1' },
        { value: 'openai', label: 'OpenAI (Direct)', defaultUrl: 'https://api.openai.com/v1' },
        { value: 'anthropic', label: 'Anthropic (Direct)', defaultUrl: 'https://api.anthropic.com/v1' },
        { value: 'custom', label: 'Custom / Local / Ollama', defaultUrl: 'http://localhost:11434/v1' },
    ]

    const MODELS = {
        openrouter: [
            'anthropic/claude-3.5-sonnet',
            'openai/gpt-4o',
            'google/gemini-flash-1.5',
            'meta-llama/llama-3-70b-instruct'
        ],
        openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'],
        custom: ['llama3', 'mistral']
    }

    const DEFAULT_MODELS = MODELS.openrouter

    useEffect(() => {
        setMounted(true)
        fetchSettings()
        fetchTelegramToken()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('project_settings')
            .select('*')
            .eq('project_key', 'ainews')
            .in('key', [
                'ai_provider', 'ai_model', 'ai_base_url', 'ai_proxy_url', // Global Defaults
                'ai_key_openrouter', 'ai_key_openai', 'ai_key_anthropic', 'ai_key_custom', // Key Vault
                'ai_api_key', // Legacy fallback
                'ingestion_schedule', 'ingestion_frequency', 'ingestion_config', // Ingestion settings,
                'telegram_bot_token', 'publish_chat_id', // Integrations
                'tilda_cookies', 'tilda_project_id', 'tilda_feed_uid',
                'vk_access_token', 'vk_owner_id',
                'ok_public_key', 'ok_access_token', 'ok_app_secret', 'ok_group_id',
                'fb_access_token', 'fb_page_id',
                'th_access_token', 'th_user_id',
                'twitter_auth_token',
                'auto_ingestion',
                'safe_publish_mode'
            ])
            .returns<any[]>()

        if (error) {
            toast.error('Не удалось загрузить настройки')
            setLoading(false)
            return
        }

        const newConfig = { ...config };
        const newKeys = { ...apiKeys };

        (data as any[])?.forEach(row => {
            // Global Defaults
            if (row.key === 'ai_provider') newConfig.provider = row.value
            if (row.key === 'ai_model') newConfig.model = row.value
            if (row.key === 'ai_base_url') newConfig.baseUrl = row.value
            if (row.key === 'ai_proxy_url') {
                newConfig.proxyUrl = row.value
                newConfig.useProxy = !!row.value
            }

            // Key Vault
            if (row.key === 'ai_key_openrouter') newKeys.openrouter = row.value
            if (row.key === 'ai_key_openai') newKeys.openai = row.value
            if (row.key === 'ai_key_anthropic') newKeys.anthropic = row.value
            if (row.key === 'ai_key_custom') newKeys.custom = row.value

            // Integrations
            if (row.key === 'telegram_bot_token') {
                newKeys.telegram_bot_token = row.value
                setTelegramToken(row.value) // Sync legacy state if needed
            }
            if (row.key === 'publish_chat_id') newKeys.publish_chat_id = row.value
            if (row.key === 'tilda_cookies') newKeys.tilda_cookies = row.value
            if (row.key === 'tilda_project_id') newKeys.tilda_project_id = row.value
            if (row.key === 'tilda_feed_uid') newKeys.tilda_feed_uid = row.value
            if (row.key === 'vk_access_token') newKeys.vk_access_token = row.value
            if (row.key === 'vk_owner_id') newKeys.vk_owner_id = row.value
            if (row.key === 'ok_public_key') newKeys.ok_public_key = row.value
            if (row.key === 'ok_access_token') newKeys.ok_access_token = row.value
            if (row.key === 'ok_app_secret') newKeys.ok_app_secret = row.value
            if (row.key === 'ok_group_id') newKeys.ok_group_id = row.value
            if (row.key === 'fb_access_token') newKeys.fb_access_token = row.value
            if (row.key === 'fb_page_id') newKeys.fb_page_id = row.value
            if (row.key === 'th_access_token') newKeys.th_access_token = row.value
            if (row.key === 'th_user_id') newKeys.th_user_id = row.value
            if (row.key === 'twitter_auth_token') newKeys.twitter_auth_token = row.value
            if (row.key === 'twitter_proxy_url') newKeys.twitter_proxy_url = row.value
        })

        const ingestConfigRaw = (data as any[]).find(s => s.key === 'ingestion_config')?.value
        if (ingestConfigRaw) {
            try {
                setIngestionConfig(JSON.parse(ingestConfigRaw))
            } catch (e) {
                // Legacy support just in case
                setIngestionConfig({})
            }
        }

        const ingestScheduleRaw = (data as any[]).find(s => s.key === 'ingestion_schedule')?.value

        if (ingestScheduleRaw) {
            try {
                const parsed = JSON.parse(ingestScheduleRaw)
                setIngestSchedule({
                    mode: parsed.mode || 'interval',
                    value: String(parsed.value || '60'),
                    days: parsed.days || []
                })
            } catch (e) {
                setIngestSchedule({ mode: 'interval', value: '60', days: [] })
            }
        } else {
            // Fallback if legacy logic used 'ingestion_frequency'
            const legacyFreq = (data as any[]).find(s => s.key === 'ingestion_frequency')?.value
            setIngestSchedule({ mode: 'interval', value: legacyFreq || '60', days: [] })
        }

        const autoIngestRaw = (data as any[]).find(s => s.key === 'auto_ingestion')?.value
        setAutoIngestion(autoIngestRaw === 'true')

        const safePublishRaw = (data as any[]).find(s => s.key === 'safe_publish_mode')?.value
        setSafePublishMode(safePublishRaw === 'true')

        // Fallback: if vault is empty but legacy key exists, populate based on provider
        const legacyKey = (data as any[]).find(r => r.key === 'ai_api_key')?.value
        if (legacyKey) {
            if (!newKeys.openrouter && (!newConfig.provider || newConfig.provider === 'openrouter')) newKeys.openrouter = legacyKey
            else if (!newKeys.openai && newConfig.provider === 'openai') newKeys.openai = legacyKey
            else if (!newKeys.anthropic && newConfig.provider === 'anthropic') newKeys.anthropic = legacyKey
        }

        setConfig(newConfig)
        setApiKeys(newKeys)

        // Load Custom sources
        const sources = await getDbSources()
        setDbSources(sources || [])

        setLoading(false)
    }

    const fetchTelegramToken = async () => {
        const { data, error } = await supabase
            .from('project_settings')
            .select('value')
            .eq('project_key', 'ainews')
            .eq('key', 'tg_bot')
            .maybeSingle()

        if (error) {
            console.error('Failed to load Telegram token:', error)
            return
        }

        if (data) {
            // @ts-ignore
            setTelegramToken(data.value || '')
        }
    }

    const handleSaveTelegramToken = async () => {
        setSavingTelegram(true)
        // @ts-ignore
        const { error } = await supabase
            .from('project_settings')
            .upsert({
                project_key: 'ainews',
                key: 'tg_bot',
                value: telegramToken,
                is_active: true
            } as any, { onConflict: 'project_key,key' })

        if (error) {
            console.error(error)
            toast.error('Не удалось сохранить токен Telegram')
        } else {
            toast.success('Токен Telegram бота сохранен')
        }
        setSavingTelegram(false)
    }

    const fetchModels = async (baseUrl: string, apiKey: string, provider: string, proxyUrl?: string) => {
        if (!baseUrl) return

        // Use the specific key for the provider
        const effectiveKey = (apiKeys as any)[provider] || apiKey;

        setFetchingModels(true)
        setAvailableModels([])

        try {
            console.log(`[Frontend] Fetching models from ${baseUrl} using provider ${provider}...`)
            const res = await fetch('/api/ai/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseUrl,
                    apiKey: effectiveKey,
                    provider,
                    proxyUrl: (config.useProxy || proxyUrl) ? (proxyUrl || config.proxyUrl) : undefined
                })
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                console.error("Model fetch failed:", errorData)
                const msg = errorData.details?.error?.message || errorData.details?.message || errorData.error || res.statusText
                throw new Error(`Provider Error: ${msg}`)
            }

            const data = await res.json()
            let models: string[] = []

            // Handle various API response formats safely.
            if (data.data && Array.isArray(data.data)) {
                // OpenAI / OpenRouter standard
                models = data.data
                    .map((m: any) => m.id || m.model_name || m.name)
                    .filter(Boolean)
            } else if (Array.isArray(data)) {
                models = data
                    .map((m: any) => typeof m === 'string' ? m : (m.id || m.name))
                    .filter(Boolean)
            } else if (data.models && Array.isArray(data.models)) {
                models = data.models
                    .map((m: any) => m.id || m.name)
                    .filter(Boolean)
            }

            models.sort()
            console.log(`[Frontend] Parsed ${models.length} models.`)

            if (models.length === 0) {
                toast.info('Провайдер не вернул моделей. Используются стандартные.')
                setAvailableModels(DEFAULT_MODELS)
            } else {
                setAvailableModels(models)
                toast.success(`Успешно получено ${models.length} моделей`)
            }

        } catch (e: any) {
            console.error('[Frontend] Fetch Models Error:', e)
            toast.error(`Не удалось получить модели: ${e.message}`)
            setAvailableModels(DEFAULT_MODELS)
        } finally {
            setFetchingModels(false)
        }
    }

    const [fetchingThreadsId, setFetchingThreadsId] = useState(false)
    const handleFetchThreadsId = async () => {
        if (!apiKeys.th_access_token) {
            toast.error('Сначала введите токен доступа')
            return
        }
        setFetchingThreadsId(true)
        try {
            // Call our server-side proxy to avoid CORS and handle connectivity better
            const res = await fetch('/api/integrations/threads-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: apiKeys.th_access_token })
            })

            const data = await res.json()
            if (data.id) {
                setApiKeys(prev => ({ ...prev, th_user_id: data.id }))
                toast.success(`Успешно! Пользователь: ${data.username || 'Threads User'}`)
            } else {
                throw new Error(data.error || 'Не удалось получить ID')
            }
        } catch (e: any) {
            toast.error(`Ошибка запроса: ${e.message}`)
        } finally {
            setFetchingThreadsId(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)

        // Update Keys
        const updates = [
            // Vault
            { project_key: 'ainews', key: 'ai_key_openrouter', value: apiKeys.openrouter, is_active: true },
            { project_key: 'ainews', key: 'ai_key_openai', value: apiKeys.openai, is_active: true },
            { project_key: 'ainews', key: 'ai_key_anthropic', value: apiKeys.anthropic, is_active: true },
            { project_key: 'ainews', key: 'ai_key_custom', value: apiKeys.custom, is_active: true },

            // Global Defaults
            { project_key: 'ainews', key: 'ai_provider', value: config.provider, is_active: true },
            { project_key: 'ainews', key: 'ai_model', value: config.model, is_active: true },
            { project_key: 'ainews', key: 'ai_base_url', value: config.baseUrl, is_active: true },
            { project_key: 'ainews', key: 'ai_proxy_url', value: config.useProxy ? config.proxyUrl : '', is_active: true },

            // Integrations
            { project_key: 'ainews', key: 'telegram_bot_token', value: apiKeys.telegram_bot_token, is_active: true },
            { project_key: 'ainews', key: 'publish_chat_id', value: apiKeys.publish_chat_id || '', is_active: true },
            { project_key: 'ainews', key: 'tilda_cookies', value: apiKeys.tilda_cookies, is_active: true },
            { project_key: 'ainews', key: 'tilda_project_id', value: apiKeys.tilda_project_id, is_active: true },
            { project_key: 'ainews', key: 'tilda_feed_uid', value: apiKeys.tilda_feed_uid, is_active: true },
            { project_key: 'ainews', key: 'vk_access_token', value: apiKeys.vk_access_token, is_active: true },
            { project_key: 'ainews', key: 'vk_owner_id', value: apiKeys.vk_owner_id, is_active: true },
            { project_key: 'ainews', key: 'ok_public_key', value: apiKeys.ok_public_key, is_active: true },
            { project_key: 'ainews', key: 'ok_access_token', value: apiKeys.ok_access_token, is_active: true },
            { project_key: 'ainews', key: 'ok_app_secret', value: apiKeys.ok_app_secret, is_active: true },
            { project_key: 'ainews', key: 'ok_group_id', value: apiKeys.ok_group_id, is_active: true },
            { project_key: 'ainews', key: 'fb_access_token', value: apiKeys.fb_access_token, is_active: true },
            { project_key: 'ainews', key: 'fb_page_id', value: apiKeys.fb_page_id, is_active: true },
            { project_key: 'ainews', key: 'th_access_token', value: apiKeys.th_access_token, is_active: true },
            { project_key: 'ainews', key: 'th_user_id', value: apiKeys.th_user_id, is_active: true },
            { project_key: 'ainews', key: 'twitter_auth_token', value: apiKeys.twitter_auth_token, is_active: true },
            { project_key: 'ainews', key: 'twitter_proxy_url', value: apiKeys.twitter_proxy_url || '', is_active: true },

            // Legacy Backwards Compatibility: Update 'ai_api_key' to match the selected provider's key
            { project_key: 'ainews', key: 'ai_api_key', value: (apiKeys as any)[config.provider] || '', is_active: true },

            // Ingestion
            { project_key: 'ainews', key: 'ingestion_config', value: JSON.stringify(ingestionConfig), is_active: true },
            { project_key: 'ainews', key: 'ingestion_schedule', value: JSON.stringify(ingestSchedule), is_active: true },
            { project_key: 'ainews', key: 'auto_ingestion', value: String(autoIngestion), is_active: true },
            { project_key: 'ainews', key: 'safe_publish_mode', value: String(safePublishMode), is_active: true }
        ]

        const { error } = await supabase
            .from('project_settings')
            .upsert(updates as any, { onConflict: 'project_key,key' })

        if (error) {
            console.error(error)
            toast.error('Не удалось сохранить настройки')
        } else {
            toast.success('Настройки успешно сохранены')
        }
        setSaving(false)
    }

    const handleProviderChange = (val: string) => {
        const provider = PROVIDERS.find(p => p.value === val)
        const newBaseUrl = provider?.defaultUrl || config.baseUrl

        setConfig(prev => ({
            ...prev,
            provider: val,
            baseUrl: newBaseUrl
        }))

        // Trigger fetch for new provider using correct key
        fetchModels(newBaseUrl, (apiKeys as any)[val], val, config.proxyUrl)
    }

    const handleResetUrl = () => {
        const provider = PROVIDERS.find(p => p.value === config.provider)
        if (provider) {
            setConfig(prev => ({ ...prev, baseUrl: provider.defaultUrl }))
            toast('Base URL сброшен к стандартному')
        }
    }

    const toggleKeyVisibility = (keyName: string) => {
        setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }))
    }

    if (!mounted) {
        return <div className="p-6 text-muted-foreground">Loading interface...</div>
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Настройки</h1>
                <p className="text-muted-foreground text-sm">
                    Конфигурация AI агентов, API ключи и системные настройки.
                </p>
            </div>

            <Tabs defaultValue="ai" className="w-full">
                <TabsList className="inline-flex h-12 w-full justify-start gap-2 rounded-xl bg-muted/50 p-1.5 sm:w-auto border border-border/50">
                    <TabsTrigger value="ai" className="px-6 py-2 text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">AI</TabsTrigger>
                    <TabsTrigger value="prompts" className="px-6 py-2 text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">Промпты</TabsTrigger>
                    <TabsTrigger value="ingestion" className="px-6 py-2 text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">Источники</TabsTrigger>
                    <TabsTrigger value="integrations" className="px-6 py-2 text-sm font-semibold transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">Интеграции</TabsTrigger>
                </TabsList>

                <TabsContent value="ai" className="mt-6 space-y-6">
                    {/* API Key Vault */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" />
                                Хранилище ключей
                            </CardTitle>
                            <CardDescription>
                                Безопасное хранение API ключей. Они будут доступны в редакторе промптов.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {PROVIDERS.map(p => (
                                <div key={p.value} className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">{p.label} Key</Label>
                                    <div className="relative">
                                        <Input
                                            type={showKeys[p.value] ? "text" : "password"}
                                            value={(apiKeys as any)[p.value]}
                                            onChange={e => setApiKeys(prev => ({ ...prev, [p.value]: e.target.value }))}
                                            className="pr-10 font-mono text-sm"
                                            placeholder={`sk-... (${p.value})`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleKeyVisibility(p.value)}
                                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                        >
                                            {showKeys[p.value] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Global Defaults */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="w-5 h-5 text-primary" />
                                Основная модель по умолчанию
                            </CardTitle>
                            <CardDescription>
                                Этот провайдер и модель будут использоваться, если в Промпте не заданы свои настройки.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Provider Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <Label>Провайдер по умолчанию</Label>
                                    <Select value={config.provider} onValueChange={handleProviderChange} disabled={loading}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите провайдера" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PROVIDERS.map(p => (
                                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Base URL */}
                                <div className="space-y-3">
                                    <Label>Base URL (Опционально)</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                value={config.baseUrl}
                                                onChange={e => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                                                className="pl-9 font-mono text-sm"
                                            />
                                        </div>
                                        <Button variant="outline" size="icon" onClick={handleResetUrl} title="Reset">
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Model Selection */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Модель по умолчанию</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs gap-1"
                                        onClick={() => fetchModels(config.baseUrl, (apiKeys as any)[config.provider], config.provider, config.proxyUrl)}
                                        disabled={fetchingModels || !(apiKeys as any)[config.provider]}
                                    >
                                        <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                                        Обновить модели
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Select
                                        value={availableModels.includes(config.model) ? config.model : "custom_input"}
                                        onValueChange={(val) => {
                                            if (val !== 'custom_input') setConfig(prev => ({ ...prev, model: val }))
                                        }}
                                        disabled={fetchingModels || (availableModels.length === 0 && !config.model)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={fetchingModels ? "Загрузка моделей..." : (config.model || "Выберите модель")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableModels.map(m => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                            <SelectItem value="custom_input">Свой ID модели...</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {(!availableModels.includes(config.model)) && (
                                        <Input
                                            value={config.model}
                                            onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                                            placeholder="e.g. deepseek/deepseek-r1"
                                            className="font-mono text-sm"
                                        />
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Proxy Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Network className="w-5 h-5 text-primary" />
                                Сеть и Прокси
                            </CardTitle>
                            <CardDescription>
                                Настройте прокси, если ваш регион блокирует доступ к AI провайдерам.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="proxy-mode" className="flex flex-col space-y-1">
                                    <span>Включить прокси</span>
                                    <span className="font-normal text-xs text-muted-foreground">Работает только для серверных AI запросов.</span>
                                </Label>
                                <Switch
                                    id="proxy-mode"
                                    checked={config.useProxy}
                                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, useProxy: checked }))}
                                />
                            </div>

                            {config.useProxy && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <Label>URL прокси</Label>
                                    <Input
                                        value={config.proxyUrl}
                                        onChange={e => setConfig(prev => ({ ...prev, proxyUrl: e.target.value }))}
                                        placeholder="http://user:password@host:port"
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Поддержка HTTP/HTTPS. Убедитесь, что прокси поддерживает метод CONNECT.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-muted/30 border-t px-6 py-4 flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                                Настройки применяются ко всем модулям немедленно.
                            </p>
                            <Button onClick={handleSave} disabled={saving || loading}>
                                {saving ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span> Сохранение...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" /> Сохранить конфигурацию
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="prompts" className="mt-6 space-y-6">
                    <div className="grid gap-6">
                        <SystemPromptsEditor />
                    </div>
                </TabsContent>

                <TabsContent value="integrations" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Telegram */}
                        <Card className="hover:scale-[1.01] transition-all duration-300 border-sky-500/20 hover:border-sky-500/50 hover:shadow-[0_0_20px_rgba(14,165,233,0.1)] group">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors duration-300 shadow-inner">
                                        <Send className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg">Telegram Бот</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold italic">Официальный канал</span>
                                    </div>
                                </CardTitle>
                                <CardDescription className="pl-[52px]">Публикация обновлений в Telegram.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Токен бота</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.telegram_bot_token}
                                        onChange={e => setApiKeys(prev => ({ ...prev, telegram_bot_token: e.target.value }))}
                                        placeholder="123456:ABC-DEF..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID чата/канала</Label>
                                    <Input
                                        value={apiKeys.publish_chat_id || ''}
                                        onChange={e => setApiKeys(prev => ({ ...prev, publish_chat_id: e.target.value }))}
                                        placeholder="-123456789"
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                    <p className="text-[10px] text-muted-foreground italic pl-1">Для групп начните с МИНУСА (-).</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* VK */}
                        <Card className="hover:scale-[1.01] transition-all duration-300 border-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] group">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-inner font-black">VK</div>
                                    <div className="flex flex-col">
                                        <span className="text-lg">ВКонтакте</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold italic">Социальная сеть</span>
                                    </div>
                                </CardTitle>
                                <CardDescription className="pl-[52px]">Настройки публикации в сообщество.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Токен доступа</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.vk_access_token}
                                        onChange={e => setApiKeys(prev => ({ ...prev, vk_access_token: e.target.value }))}
                                        placeholder="vk1.a.Is..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID владельца (ID группы)</Label>
                                    <Input
                                        value={apiKeys.vk_owner_id}
                                        onChange={e => setApiKeys(prev => ({ ...prev, vk_owner_id: e.target.value }))}
                                        placeholder="-123456789"
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* OK */}
                        <Card className="hover:scale-[1.01] transition-all duration-300 border-orange-500/20 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] group">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300 shadow-inner font-black">OK</div>
                                    <div className="flex flex-col">
                                        <span className="text-lg">Одноклассники</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold italic">Социальная сеть</span>
                                    </div>
                                </CardTitle>
                                <CardDescription className="pl-[52px]">Настройки публикации в группу.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Публичный ключ</Label>
                                        <Input
                                            value={apiKeys.ok_public_key}
                                            onChange={e => setApiKeys(prev => ({ ...prev, ok_public_key: e.target.value }))}
                                            placeholder="CBA..."
                                            className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID группы</Label>
                                        <Input
                                            value={apiKeys.ok_group_id}
                                            onChange={e => setApiKeys(prev => ({ ...prev, ok_group_id: e.target.value }))}
                                            placeholder="54321..."
                                            className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Токен доступа</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.ok_access_token}
                                        onChange={e => setApiKeys(prev => ({ ...prev, ok_access_token: e.target.value }))}
                                        placeholder="tkn.a.Is..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Секретный ключ приложения</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.ok_app_secret}
                                        onChange={e => setApiKeys(prev => ({ ...prev, ok_app_secret: e.target.value }))}
                                        placeholder="secr..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Facebook */}
                        <Card className="hover:scale-[1.01] transition-all duration-300 border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(79,70,229,0.1)] group">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300 shadow-inner font-black whitespace-pre">FB</div>
                                    <div className="flex flex-col">
                                        <span className="text-lg">Страница Facebook</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold italic">Платформа Meta</span>
                                    </div>
                                </CardTitle>
                                <CardDescription className="pl-[52px]">Публикация на стену страницы Facebook.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID страницы</Label>
                                    <Input
                                        value={apiKeys.fb_page_id}
                                        onChange={e => setApiKeys(prev => ({ ...prev, fb_page_id: e.target.value }))}
                                        placeholder="1092..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Токен доступа к странице</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.fb_access_token}
                                        onChange={e => setApiKeys(prev => ({ ...prev, fb_access_token: e.target.value }))}
                                        placeholder="EAAQ..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Threads */}
                        <Card className="hover:scale-[1.01] transition-all duration-300 border-zinc-500/20 hover:border-foreground/50 hover:shadow-[0_0_20px_rgba(0,0,0,0.05)] group">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-500/10 flex items-center justify-center text-foreground group-hover:bg-foreground group-hover:text-background transition-colors duration-300 shadow-inner font-black">TH</div>
                                    <div className="flex flex-col">
                                        <span className="text-lg">Threads</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold italic">Платформа Meta</span>
                                    </div>
                                </CardTitle>
                                <CardDescription className="pl-[52px]">Публикация в профиль Threads.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID пользователя</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px] gap-1 px-2"
                                            onClick={handleFetchThreadsId}
                                            disabled={fetchingThreadsId || !apiKeys.th_access_token}
                                        >
                                            <RefreshCw className={`w-3 h-3 ${fetchingThreadsId ? 'animate-spin' : ''}`} />
                                            Получить автоматически
                                        </Button>
                                    </div>
                                    <Input
                                        value={apiKeys.th_user_id}
                                        onChange={e => setApiKeys(prev => ({ ...prev, th_user_id: e.target.value }))}
                                        placeholder="1784..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Токен доступа</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.th_access_token}
                                        onChange={e => setApiKeys(prev => ({ ...prev, th_access_token: e.target.value }))}
                                        placeholder="EAAQ..."
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Twitter / X */}
                        <Card className="hover:scale-[1.01] transition-all duration-300 border-zinc-800/20 hover:border-zinc-800/50 hover:shadow-[0_0_20px_rgba(0,0,0,0.1)] group">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-800/10 flex items-center justify-center text-foreground group-hover:bg-foreground group-hover:text-background transition-colors duration-300 shadow-inner font-black whitespace-pre"> X </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg tracking-tighter">Twitter / X</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold italic">Session Scraper</span>
                                    </div>
                                </CardTitle>
                                <CardDescription className="pl-[52px]">Публикация в X используя сессионные куки (бесплатно).</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auth Token (Cookies)</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.twitter_auth_token}
                                        onChange={e => setApiKeys(prev => ({ ...prev, twitter_auth_token: e.target.value }))}
                                        placeholder="auth_token=...; ct0=...;"
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                    <p className="text-[10px] text-muted-foreground italic pl-1 flex items-center gap-1">
                                        <ExternalLink className="w-2 h-2" />
                                        Используйте расширение <span className="underline decoration-dotted cursor-help">X Auth Helper</span> чтобы получить строку.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proxy URL (Optional)</Label>
                                    <Input
                                        value={apiKeys.twitter_proxy_url}
                                        onChange={e => setApiKeys(prev => ({ ...prev, twitter_proxy_url: e.target.value }))}
                                        placeholder="http://user:pass@host:port"
                                        className="font-mono text-sm bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tilda - Full Width */}
                        <Card className="md:col-span-2 hover:shadow-[0_0_30px_rgba(249,115,22,0.05)] transition-all duration-300 border-orange-500/10 hover:border-orange-500/40 group overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-orange-500/10 transition-colors" />
                            <CardHeader className="pb-4 relative">
                                <CardTitle className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-500 shadow-inner font-serif text-xl font-black italic">T</div>
                                    <div className="flex flex-col">
                                        <span className="text-xl font-bold tracking-tight">Tilda Publishing</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold italic opacity-70">Основной веб-хаб</span>
                                    </div>
                                </CardTitle>
                                <CardDescription className="pl-[60px] text-base italic opacity-80 font-serif">Настройка Feeds API для вашего новостного портала.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-2 gap-8 relative pt-2">
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animation-pulse" />
                                            Сессия Tilda (Cookies)
                                        </Label>
                                        <Textarea
                                            value={apiKeys.tilda_cookies}
                                            onChange={e => setApiKeys(prev => ({ ...prev, tilda_cookies: e.target.value }))}
                                            placeholder="PHPSESSID=...; tilda_uid=..."
                                            className="font-mono text-xs min-h-[140px] bg-muted/20 border-muted-foreground/10 focus:bg-background transition-all resize-none shadow-inner"
                                        />
                                        <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                                            <Info className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                                Откройте <span className="font-bold text-orange-600/80">DevTools -&gt; Application -&gt; Cookies</span> и скопируйте строку целиком.
                                                Убедитесь что <code className="bg-orange-500/10 px-1 rounded not-italic">PHPSESSID</code> присутствует и обновляйте регулярно.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-3 pt-1">
                                        <Label className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Параметры проекта</Label>
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-tighter">PRJ</div>
                                                <Input
                                                    value={apiKeys.tilda_project_id}
                                                    onChange={e => setApiKeys(prev => ({ ...prev, tilda_project_id: e.target.value }))}
                                                    placeholder="7604066"
                                                    className="font-mono text-sm pl-10 bg-muted/20 border-muted-foreground/10 focus:bg-background transition-all"
                                                />
                                            </div>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-tighter font-mono">FEED</div>
                                                <Input
                                                    value={apiKeys.tilda_feed_uid}
                                                    onChange={e => setApiKeys(prev => ({ ...prev, tilda_feed_uid: e.target.value }))}
                                                    placeholder="175116416341"
                                                    className="font-mono text-sm pl-11 bg-muted/20 border-muted-foreground/10 focus:bg-background transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-dashed border-orange-500/20 bg-orange-500/[0.02] flex items-center justify-center min-h-[80px]">
                                        <div className="text-center space-y-1">
                                            <div className="text-[10px] font-semibold text-orange-500/60 uppercase">Статус системы</div>
                                            <div className="text-xs italic text-muted-foreground">Готов к синхронизации потоков</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={saving} size="lg" className="px-8 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95">
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Сохранить все интеграции
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="ingestion" className="mt-6 space-y-6">
                    {/* Global Automation Switchers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-primary/20 bg-primary/[0.02]">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <RefreshCw className={`w-5 h-5 ${autoIngestion ? 'text-primary' : 'text-muted-foreground'}`} />
                                    Авто-сбор (Ingestion)
                                </CardTitle>
                                <CardDescription>Глобальное включение/выключение крона в БД.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <span className="text-sm font-medium">{autoIngestion ? 'Активен' : 'Отключен'}</span>
                                <Switch checked={autoIngestion} onCheckedChange={setAutoIngestion} />
                            </CardContent>
                        </Card>

                        <Card className="border-orange-500/20 bg-orange-500/[0.02]">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg text-orange-600">
                                    <SwitchCamera className="w-5 h-5" />
                                    Безопасный режим (Safe Mode)
                                </CardTitle>
                                <CardDescription>Включение симуляции вместо реальной публикации.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <span className="text-sm font-medium text-orange-600/80">{safePublishMode ? 'Симуляция ВКЛ' : 'Реальная публикация'}</span>
                                <Switch checked={safePublishMode} onCheckedChange={setSafePublishMode} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* 1. Schedule & Control */}
                    <Card className="hover:shadow-md transition-shadow duration-300">
                        <CardHeader className="pb-3 px-6 pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Расписание автоматизации</CardTitle>
                                    <CardDescription>Когда система должна проверять новые материалы.</CardDescription>
                                </div>
                                <Button
                                    variant="secondary"
                                    className="gap-2 shadow-sm"
                                    onClick={async () => {
                                        setIngestionRunning(true)
                                        toast.info('Запуск сканирования...')
                                        const activeIds = allSources
                                            .filter(s => {
                                                const cfg = ingestionConfig[s.id]
                                                return cfg ? cfg.isActive : s.isActive
                                            })
                                            .map(s => s.id)

                                        const res = await triggerIngestion(activeIds)
                                        if (res.success && res.data) {
                                            toast.success(`Готово! Добавлено: ${res.data.newInserted}`)
                                        } else {
                                            toast.error('Ошибка: ' + res.error)
                                        }
                                        setIngestionRunning(false)
                                    }}
                                    disabled={ingestionRunning || saving}
                                >
                                    {ingestionRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    Запустить сейчас
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-6">
                            <div className="flex flex-col sm:flex-row gap-4 sm:items-end bg-muted/20 p-4 rounded-xl border">
                                <div className="space-y-2 min-w-[200px]">
                                    <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Режим запуска</Label>
                                    <Select
                                        value={ingestSchedule.mode}
                                        onValueChange={(v) => setIngestSchedule({ ...ingestSchedule, mode: v })}
                                    >
                                        <SelectTrigger className="bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="interval">С обычным интервалом</SelectItem>
                                            <SelectItem value="daily">Ежедневно (по времени)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {ingestSchedule.mode === 'interval' && (
                                    <div className="space-y-2 min-w-[200px]">
                                        <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Интервал</Label>
                                        <Select
                                            value={ingestSchedule.value}
                                            onValueChange={(v) => setIngestSchedule({ ...ingestSchedule, value: v })}
                                        >
                                            <SelectTrigger className="bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="15">Каждые 15 минут</SelectItem>
                                                <SelectItem value="30">Каждые 30 минут</SelectItem>
                                                <SelectItem value="60">Каждый час</SelectItem>
                                                <SelectItem value="180">Каждые 3 часа</SelectItem>
                                                <SelectItem value="360">Каждые 6 часов</SelectItem>
                                                <SelectItem value="720">Каждые 12 часов</SelectItem>
                                                <SelectItem value="1440">Раз в сутки (24ч)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {ingestSchedule.mode === 'daily' && (
                                    <div className="space-y-2 min-w-[150px]">
                                        <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Время (UTC)</Label>
                                        <Input
                                            type="time"
                                            value={ingestSchedule.value}
                                            onChange={(e) => setIngestSchedule({ ...ingestSchedule, value: e.target.value })}
                                            className="bg-background"
                                        />
                                    </div>
                                )}

                                <div className="pl-2">
                                    <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-6">
                                        {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                        <Save className="w-4 h-4 mr-2" />
                                        Применить
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Sources List */}
                    <Card className="hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 overflow-hidden border-muted/40">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-muted/5">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                                    <Globe className="w-5 h-5 text-primary" />
                                    Активные источники
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Управление RSS лентами и скраперами.
                                </CardDescription>
                            </div>
                            <AddSourceDialog onSuccess={() => fetchSettings()} />
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-muted/10">
                                {allSources.map(source => {
                                    const isConfigured = ingestionConfig[source.id]
                                    const isActive = isConfigured ? isConfigured.isActive : source.isActive
                                    const Icon = source.type === 'rss' ? Rss : (source.id.includes('orders') ? FileText : Globe)

                                    return (
                                        <div key={source.id} className="flex items-center justify-between p-5 hover:bg-primary/[0.01] transition-all group/item">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className={`p-3 rounded-2xl shadow-sm border transition-all duration-300 ${isActive ? 'bg-primary/10 border-primary/20 text-primary scale-100' : 'bg-background border-muted text-muted-foreground scale-95 opacity-60'}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm text-foreground group-hover/item:text-primary transition-colors">{source.name}</p>
                                                        {source.is_custom && <span className="text-[10px] items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-bold border border-blue-500/20 uppercase tracking-tighter">Свой</span>}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground truncate max-w-[400px] font-mono opacity-70">
                                                        <a href={source.url} target="_blank" className="hover:text-primary transition-colors flex items-center gap-1">
                                                            {source.url}
                                                        </a>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 pl-4">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-green-500' : 'text-muted-foreground/50'}`}>
                                                        {isActive ? 'Работает' : 'Пауза'}
                                                    </span>
                                                    <Switch
                                                        checked={isActive}
                                                        onCheckedChange={async (checked: boolean) => {
                                                            if (source.is_custom) {
                                                                // DB Source: Update via Server Action
                                                                const res = await toggleSourceActive(source.id, checked)
                                                                if (res.success) {
                                                                    setDbSources(prev => prev.map(s => s.id === source.id ? { ...s, is_active: checked } : s))
                                                                    toast.success(checked ? 'Источник включен' : 'Источник выключен')
                                                                } else {
                                                                    toast.error('Ошибка обновления статуса')
                                                                }
                                                            } else {
                                                                // Legacy Source: Update config JSON
                                                                setIngestionConfig(prev => ({
                                                                    ...prev,
                                                                    [source.id]: { isActive: checked }
                                                                }))
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                {source.is_custom && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all rounded-xl"
                                                        onClick={async () => {
                                                            if (confirm('Удалить источник?')) {
                                                                await deleteSource(source.id)
                                                                fetchSettings()
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/30 border-t py-3 px-6 flex justify-between items-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            <span>Total Sources: {allSources.length} Active</span>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
