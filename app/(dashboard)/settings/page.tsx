'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TutorialButton } from '@/components/tutorial/TutorialButton'
import { getSettingsTutorialSteps } from '@/lib/tutorial/tutorial-config'
import { useMemo } from 'react'
import { LEGACY_SOURCES } from '@/lib/ingestion/sources'
import { getDbSources } from '@/app/actions/scan-source-actions'
import { SystemPromptsEditor } from '@/components/system-prompts-editor'
import { AiCorrectionLogs } from '@/components/settings/ai-correction-logs'
import { reportClientError } from '@/lib/client-error'

// Split components
import { AIConfigTab } from '@/components/settings/ai-config-tab'
import { DataIngestionTab } from '@/components/settings/data-ingestion-tab'
import { IntegrationsTab } from '@/components/settings/integrations-tab'
import type { AIConfig, ApiKeys, IngestSchedule } from '@/components/settings/types'

const PROVIDERS = [
    { label: 'OpenRouter', value: 'openrouter', defaultUrl: 'https://openrouter.ai/api/v1' },
    { label: 'OpenAI', value: 'openai', defaultUrl: 'https://api.openai.com/v1' },
    { label: 'Anthropic', value: 'anthropic', defaultUrl: 'https://api.anthropic.com/v1' },
    { label: 'Custom (OpenAI Compatible)', value: 'custom', defaultUrl: '' },
]

const PROJECT_KEY = 'ainews'

const AI_KEY_MAP: Record<string, string> = {
    openrouter: 'ai_key_openrouter',
    openai: 'ai_key_openai',
    anthropic: 'ai_key_anthropic',
    custom: 'ai_key_custom',
    telegram_bot_token: 'telegram_bot_token',
    publish_chat_id: 'publish_chat_id',
    telegram_draft_chat_id: 'telegram_draft_chat_id',
    telegram_error_chat_id: 'telegram_error_chat_id',
    tilda_cookies: 'tilda_cookies',
    tilda_project_id: 'tilda_project_id',
    tilda_feed_uid: 'tilda_feed_uid',
    vk_access_token: 'vk_access_token',
    vk_api_version: 'vk_api_version',
    vk_owner_id: 'vk_owner_id',
    ok_access_token: 'ok_access_token',
    ok_app_secret: 'ok_app_secret',
    ok_public_key: 'ok_public_key',
    ok_group_id: 'ok_group_id',
    twitter_auth_token: 'twitter_auth_token',
    fb_access_token: 'fb_access_token',
    fb_page_id: 'fb_page_id',
    th_access_token: 'th_access_token',
    th_user_id: 'th_user_id'
}

export default function SettingsPage() {
    const supabase = createClient()
    const [mounted, setMounted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [fetchingModels, setFetchingModels] = useState(false)
    const [fetchingThreadsId, setFetchingThreadsId] = useState(false)

    // Visibility toggles for keys
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

    // Dynamic list of models fetched from API
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [availableImageModels, setAvailableImageModels] = useState<string[]>([])

    // Global Defaults Configuration
    const [config, setConfig] = useState<AIConfig>({
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
        baseUrl: 'https://openrouter.ai/api/v1',
        proxyUrl: '',
        useProxy: false,
        imageProvider: 'global',
        imageModel: '',
        autoGenerateSocial: false
    })

    // Key Vault
    const [apiKeys, setApiKeys] = useState<ApiKeys>({
        openrouter: '',
        openai: '',
        anthropic: '',
        custom: '',
        telegram_bot_token: '',
        publish_chat_id: '',
        telegram_draft_chat_id: '',
        tilda_cookies: '',
        tilda_project_id: '',
        tilda_feed_uid: '',
        vk_access_token: '',
        vk_api_version: '5.131',
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
        telegram_error_chat_id: ''
    })

    const [activeTab, setActiveTab] = useState('ai')

    const settingsTutorialSteps = useMemo(() => getSettingsTutorialSteps(setActiveTab), [setActiveTab])

    const [ingestionConfig, setIngestionConfig] = useState<Record<string, { isActive: boolean }>>({})
    const [ingestionRunning, setIngestionRunning] = useState(false)
    const [ingestSchedule, setIngestSchedule] = useState<IngestSchedule>({
        mode: 'interval',
        value: '60',
        days: []
    })
    const [dbSources, setDbSources] = useState<any[]>([])
    const [autoIngestion, setAutoIngestion] = useState(true)
    const [safePublishMode, setSafePublishMode] = useState(true)

    const fetchSettings = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('project_settings')
                .select('*')
                .eq('project_key', PROJECT_KEY)

            if (error) throw error

            const settingsMap = (data || []).reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            // 1. Keys
            setApiKeys(prev => {
                const next = { ...prev }
                Object.keys(next).forEach(k => {
                    const lookupKey = AI_KEY_MAP[k] || k
                    const value = settingsMap[lookupKey]
                    if (value !== undefined && value !== null) (next as any)[k] = String(value)
                })
                return next
            })

            // 2. AI Config
            setConfig(prev => {
                const next = { ...prev }
                if (settingsMap.ai_provider) next.provider = settingsMap.ai_provider
                if (settingsMap.ai_model) next.model = settingsMap.ai_model
                if (settingsMap.ai_base_url) next.baseUrl = settingsMap.ai_base_url
                if (settingsMap.ai_proxy_url) next.proxyUrl = settingsMap.ai_proxy_url
                if (settingsMap.ai_proxy_enabled !== undefined) {
                    next.useProxy = settingsMap.ai_proxy_enabled === 'true'
                } else if (settingsMap.ai_use_proxy !== undefined) {
                    next.useProxy = settingsMap.ai_use_proxy === 'true'
                }
                if (settingsMap.ai_image_provider) next.imageProvider = settingsMap.ai_image_provider
                if (settingsMap.ai_image_model) next.imageModel = settingsMap.ai_image_model
                if (settingsMap.auto_generate_social_posts !== undefined) {
                    next.autoGenerateSocial = settingsMap.auto_generate_social_posts === 'true'
                }
                return next
            })

            // 3. Ingestion
            if (settingsMap.ingestion_config) {
                try {
                    setIngestionConfig(JSON.parse(settingsMap.ingestion_config))
                } catch { }
            }
            if (settingsMap.ingest_schedule) {
                try {
                    setIngestSchedule(JSON.parse(settingsMap.ingest_schedule))
                } catch { }
            }
            if (settingsMap.auto_ingestion) setAutoIngestion(settingsMap.auto_ingestion === 'true')
            if (settingsMap.safe_publish_mode) setSafePublishMode(settingsMap.safe_publish_mode === 'true')

            // 4. Sources
            const dbData = await getDbSources()
            if (Array.isArray(dbData)) {
                setDbSources(dbData)
            }

        } catch (e: any) {
            toast.error(e.message)
            reportClientError({
                message: e?.message || 'Failed to load settings',
                stack: e?.stack,
                source: 'settings.fetch'
            })
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        setMounted(true)
        fetchSettings()
    }, [fetchSettings])

    const handleSave = async () => {
        setSaving(true)
        try {
            const rows = [
                ...Object.entries(apiKeys).map(([key, value]) => ({
                    key: AI_KEY_MAP[key] || key,
                    value
                })),
                { key: 'ai_provider', value: config.provider },
                { key: 'ai_model', value: config.model },
                { key: 'ai_base_url', value: config.baseUrl },
                { key: 'ai_proxy_url', value: config.proxyUrl },
                { key: 'ai_proxy_enabled', value: String(config.useProxy) },
                { key: 'ai_image_provider', value: config.imageProvider },
                { key: 'ai_image_model', value: config.imageModel },
                { key: 'auto_generate_social_posts', value: String(config.autoGenerateSocial) },
                { key: 'ingest_schedule', value: JSON.stringify(ingestSchedule) },
                { key: 'auto_ingestion', value: String(autoIngestion) },
                { key: 'safe_publish_mode', value: String(safePublishMode) },
                { key: 'ingestion_config', value: JSON.stringify(ingestionConfig) }
            ].map((row) => ({ ...row, project_key: PROJECT_KEY }))

            const { error } = await supabase
                .from('project_settings')
                .upsert(rows, { onConflict: 'project_key,key' })

            if (error) throw error
            toast.success('Настройки сохранены')
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    const updateSingleSetting = async (key: string, value: string) => {
        try {
            await supabase
                .from('project_settings')
                .upsert({ key, value, project_key: PROJECT_KEY }, { onConflict: 'project_key,key' })
        } catch (e) {
            console.error('Update single setting failed:', e)
        }
    }

    const handleProviderChange = (val: string) => {
        const p = PROVIDERS.find(x => x.value === val)
        if (p) {
            setConfig(prev => ({
                ...prev,
                provider: val,
                baseUrl: p.defaultUrl || prev.baseUrl
            }))
        }
    }

    const handleResetUrl = () => {
        const p = PROVIDERS.find(x => x.value === config.provider)
        if (p) {
            setConfig(prev => ({ ...prev, baseUrl: p.defaultUrl }))
        }
    }

    const toggleKeyVisibility = (keyName: string) => {
        setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }))
    }

    const handleFetchThreadsId = async () => {
        if (!apiKeys.th_access_token) return;
        setFetchingThreadsId(true);
        try {
            const res = await fetch('/api/integrations/threads-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: apiKeys.th_access_token })
            });
            const data = await res.json();
            if (data.id) {
                setApiKeys(prev => ({ ...prev, th_user_id: data.id }));
                toast.success(`Threads ID получен: ${data.id}`);
            } else {
                toast.error(data.error || data.error?.message || 'Failed to fetch Threads ID');
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setFetchingThreadsId(false);
        }
    }

    const allSources = [
        ...LEGACY_SOURCES,
        ...dbSources.map(s => ({
            id: s.id,
            name: s.name,
            url: s.url,
            type: s.type || 'WEB',
            isActive: s.is_active,
            is_custom: true
        }))
    ]

    if (!mounted) return null

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20 p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-3">
                    <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                        Settings Center
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg italic opacity-70">
                        Управление искусственным интеллектом, источниками данных и внешними интеграциями.
                    </p>
                </div>
                <TutorialButton label="Помощь" steps={settingsTutorialSteps} variant="outline" className="h-12 px-6 rounded-2xl border-2 font-black uppercase tracking-widest text-xs" />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList data-tutorial="settings-tabs" className="flex flex-wrap h-auto gap-2 bg-muted/30 p-2 rounded-2xl border-2 border-border/50">
                    <TabsTrigger data-tutorial="settings-tab-ai" value="ai" className="flex-1 py-4 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-2 data-[state=active]:border-primary/20 transition-all">AI Конфигурация</TabsTrigger>
                    <TabsTrigger data-tutorial="settings-tab-ingestion" value="ingestion" className="flex-1 py-4 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-2 data-[state=active]:border-primary/20 transition-all">Источники и Сбор</TabsTrigger>
                    <TabsTrigger data-tutorial="settings-tab-integrations" value="integrations" className="flex-1 py-4 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-2 data-[state=active]:border-primary/20 transition-all">Соцсети и API</TabsTrigger>
                    <TabsTrigger data-tutorial="settings-tab-prompts" value="prompts" className="flex-1 py-4 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-2 data-[state=active]:border-primary/20 transition-all">Промпты</TabsTrigger>
                    <TabsTrigger data-tutorial="settings-tab-logs" value="logs" className="flex-1 py-4 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-2 data-[state=active]:border-primary/20 transition-all">Логи ИИ</TabsTrigger>
                </TabsList>

                <TabsContent value="ai">
                    <AIConfigTab
                        PROVIDERS={PROVIDERS}
                        config={config}
                        setConfig={setConfig}
                        apiKeys={apiKeys}
                        setApiKeys={setApiKeys}
                        availableModels={availableModels}
                        availableImageModels={availableImageModels}
                        setAvailableModels={setAvailableModels}
                        setAvailableImageModels={setAvailableImageModels}
                        fetchingModels={fetchingModels}
                        setFetchingModels={setFetchingModels}
                        loading={loading}
                        saving={saving}
                        handleSave={handleSave}
                        handleProviderChange={handleProviderChange}
                        handleResetUrl={handleResetUrl}
                        showKeys={showKeys}
                        toggleKeyVisibility={toggleKeyVisibility}
                        updateSingleSetting={updateSingleSetting}
                    />
                </TabsContent>

                <TabsContent value="ingestion">
                    <DataIngestionTab
                        autoIngestion={autoIngestion}
                        setAutoIngestion={setAutoIngestion}
                        safePublishMode={safePublishMode}
                        setSafePublishMode={setSafePublishMode}
                        ingestSchedule={ingestSchedule}
                        setIngestSchedule={setIngestSchedule}
                        allSources={allSources}
                        ingestionConfig={ingestionConfig}
                        setIngestionConfig={setIngestionConfig}
                        dbSources={dbSources}
                        setDbSources={setDbSources}
                        loading={loading}
                        saving={saving}
                        ingestionRunning={ingestionRunning}
                        setIngestionRunning={setIngestionRunning}
                        fetchSettings={fetchSettings}
                        handleSave={handleSave}
                        updateSingleSetting={updateSingleSetting}
                    />
                </TabsContent>

                <TabsContent value="integrations">
                    <IntegrationsTab
                        apiKeys={apiKeys}
                        setApiKeys={setApiKeys}
                        saving={saving}
                        handleSave={handleSave}
                        handleFetchThreadsId={handleFetchThreadsId}
                        fetchingThreadsId={fetchingThreadsId}
                    />
                </TabsContent>

                <TabsContent value="prompts" className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <SystemPromptsEditor />
                </TabsContent>

                <TabsContent value="logs" className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <AiCorrectionLogs />
                </TabsContent>
            </Tabs>
        </div>
    )
}
