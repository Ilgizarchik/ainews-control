'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, RefreshCw, Save, Info, ExternalLink } from 'lucide-react'
import type { ApiKeys } from '@/components/settings/types'

interface IntegrationsTabProps {
    apiKeys: ApiKeys
    setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>
    saving: boolean
    handleSave: () => void
    handleFetchThreadsId: () => void
    fetchingThreadsId: boolean
}

export function IntegrationsTab({
    apiKeys,
    setApiKeys,
    saving,
    handleSave,
    handleFetchThreadsId,
    fetchingThreadsId
}: IntegrationsTabProps) {
    return (
        <TabsIntegrationContent
            apiKeys={apiKeys}
            setApiKeys={setApiKeys}
            saving={saving}
            handleSave={handleSave}
            handleFetchThreadsId={handleFetchThreadsId}
            fetchingThreadsId={fetchingThreadsId}
        />
    )
}

function TabsIntegrationContent({
    apiKeys,
    setApiKeys,
    saving,
    handleSave,
    handleFetchThreadsId,
    fetchingThreadsId
}: IntegrationsTabProps) {
    const errorChatId = apiKeys.telegram_error_chat_id || ''
    const errorChatIdTrim = errorChatId.trim()
    const isErrorChatValid = !errorChatIdTrim || /^-?\d+$/.test(errorChatIdTrim)
    const errorChatLabelClass = isErrorChatValid
        ? 'text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70'
        : 'text-[10px] font-black uppercase tracking-[0.2em] text-red-500/70'
    const errorChatInputClass = isErrorChatValid
        ? 'h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-sky-500/20 transition-all font-bold'
        : 'h-12 font-mono text-xs bg-red-500/5 border-red-500/20 border-2 rounded-xl focus:ring-red-500/20 transition-all font-bold text-red-600 dark:text-red-400'

    return (
        <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div data-tutorial="settings-integrations" className="grid gap-8 md:grid-cols-2">
                {/* Telegram */}
                <Card className="hover:scale-[1.02] transition-all duration-500 border-2 border-sky-500/20 hover:border-sky-500/50 hover:shadow-[0_20px_40px_rgba(14,165,233,0.15)] group rounded-3xl overflow-hidden bg-gradient-to-br from-background to-sky-50/30 dark:to-sky-950/10">
                    <CardHeader className="pb-4 border-b-2 border-border/50 bg-gradient-to-r from-sky-500/5 to-transparent">
                        <CardTitle className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 group-hover:scale-110 transition-transform duration-500">
                                <Send className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight">Telegram Бот</span>
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 uppercase tracking-widest font-black italic opacity-80">Официальный канал</span>
                            </div>
                        </CardTitle>
                        <CardDescription className="pl-1 text-sm font-medium">Публикация обновлений в Telegram.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8 px-8 pb-8">
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Токен бота</Label>
                            <div className="relative">
                                <Input
                                    type="password"
                                    value={apiKeys.telegram_bot_token}
                                    onChange={e => setApiKeys(prev => ({ ...prev, telegram_bot_token: e.target.value }))}
                                    placeholder="123456:ABC-DEF..."
                                    className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-sky-500/20 transition-all font-bold"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">ID чата/канала для ПОСТОВ</Label>
                                <Input
                                    value={apiKeys.publish_chat_id || ''}
                                    onChange={e => setApiKeys(prev => ({ ...prev, publish_chat_id: e.target.value }))}
                                    placeholder="-123456789"
                                    className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-sky-500/20 transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70 cursor-help" title="Используется для загрузки медиа-ассетов">ID чата для ЧЕРНОВИКОВ <Info className="inline w-3 h-3 mb-0.5 opacity-50" /></Label>
                                <Input
                                    value={apiKeys.telegram_draft_chat_id || ''}
                                    onChange={e => setApiKeys(prev => ({ ...prev, telegram_draft_chat_id: e.target.value }))}
                                    placeholder="-123456789"
                                    className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-sky-500/20 transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label className={errorChatLabelClass}>ID чата для ОШИБОК</Label>
                                <Input
                                    value={errorChatId}
                                    onChange={e => setApiKeys(prev => ({ ...prev, telegram_error_chat_id: e.target.value }))}
                                    placeholder="-123456789"
                                    className={errorChatInputClass}
                                />
                                {!isErrorChatValid && (
                                    <p className="text-[10px] text-red-500 font-bold">
                                        Нужен числовой chat_id, например -123456789
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* VK */}
                <Card className="hover:scale-[1.02] transition-all duration-500 border-2 border-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_20px_40px_rgba(59,130,246,0.15)] group rounded-3xl overflow-hidden bg-gradient-to-br from-background to-blue-50/30 dark:to-blue-950/10">
                    <CardHeader className="pb-4 border-b-2 border-border/50 bg-gradient-to-r from-blue-500/5 to-transparent">
                        <CardTitle className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-500 text-xl font-black italic">VK</div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight">ВКонтакте</span>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-widest font-black italic opacity-80">Социальная сеть</span>
                            </div>
                        </CardTitle>
                        <CardDescription className="pl-1 text-sm font-medium">Настройки публикации в сообщество.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8 px-8 pb-8">
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Токен доступа</Label>
                            <Input
                                type="password"
                                value={apiKeys.vk_access_token}
                                onChange={e => setApiKeys(prev => ({ ...prev, vk_access_token: e.target.value }))}
                                placeholder="vk1.a.Is..."
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-blue-500/20 transition-all font-bold"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">ID сообщества (с минусом)</Label>
                                <Input
                                    value={apiKeys.vk_owner_id}
                                    onChange={e => setApiKeys(prev => ({ ...prev, vk_owner_id: e.target.value }))}
                                    placeholder="-123456789"
                                    className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-blue-500/20 transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Версия API</Label>
                                <Input
                                    value={apiKeys.vk_api_version}
                                    onChange={e => setApiKeys(prev => ({ ...prev, vk_api_version: e.target.value }))}
                                    placeholder="5.131"
                                    className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-blue-500/20 transition-all font-bold"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* OK */}
                <Card className="hover:scale-[1.02] transition-all duration-500 border-2 border-orange-500/20 hover:border-orange-500/50 hover:shadow-[0_20px_40px_rgba(249,115,22,0.15)] group rounded-3xl overflow-hidden bg-gradient-to-br from-background to-orange-50/30 dark:to-orange-950/10">
                    <CardHeader className="pb-4 border-b-2 border-border/50 bg-gradient-to-r from-orange-500/5 to-transparent">
                        <CardTitle className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform duration-500 text-xl font-black italic">OK</div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight">Одноклассники</span>
                                <span className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-widest font-black italic opacity-80">Социальная сеть</span>
                            </div>
                        </CardTitle>
                        <CardDescription className="pl-1 text-sm font-medium">Публикация контента в группы ОК.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8 px-8 pb-8">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Public Key</Label>
                                <Input
                                    value={apiKeys.ok_public_key}
                                    onChange={e => setApiKeys(prev => ({ ...prev, ok_public_key: e.target.value }))}
                                    placeholder="CBA..."
                                    className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-orange-500/20 transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Group ID</Label>
                                <Input
                                    value={apiKeys.ok_group_id}
                                    onChange={e => setApiKeys(prev => ({ ...prev, ok_group_id: e.target.value }))}
                                    placeholder="54321..."
                                    className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-orange-500/20 transition-all font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Access Token</Label>
                            <Input
                                type="password"
                                value={apiKeys.ok_access_token}
                                onChange={e => setApiKeys(prev => ({ ...prev, ok_access_token: e.target.value }))}
                                placeholder="tkn.a.Is..."
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-orange-500/20 transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Secret Key</Label>
                            <Input
                                type="password"
                                value={apiKeys.ok_app_secret}
                                onChange={e => setApiKeys(prev => ({ ...prev, ok_app_secret: e.target.value }))}
                                placeholder="secr..."
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-orange-500/20 transition-all font-bold"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Facebook */}
                <Card className="hover:scale-[1.02] transition-all duration-500 border-2 border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-[0_20px_40px_rgba(79,70,229,0.15)] group rounded-3xl overflow-hidden bg-gradient-to-br from-background to-indigo-50/30 dark:to-indigo-950/10">
                    <CardHeader className="pb-4 border-b-2 border-border/50 bg-gradient-to-r from-indigo-500/5 to-transparent">
                        <CardTitle className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-500 text-xl font-black italic whitespace-pre">FB</div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight">FB Page</span>
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-black italic opacity-80">Платформа Meta</span>
                            </div>
                        </CardTitle>
                        <CardDescription className="pl-1 text-sm font-medium">Публикация на стену страницы Facebook.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8 px-8 pb-8">
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">ID страницы</Label>
                            <Input
                                value={apiKeys.fb_page_id}
                                onChange={e => setApiKeys(prev => ({ ...prev, fb_page_id: e.target.value }))}
                                placeholder="1092..."
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-indigo-500/20 transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Access Token</Label>
                            <Input
                                type="password"
                                value={apiKeys.fb_access_token}
                                onChange={e => setApiKeys(prev => ({ ...prev, fb_access_token: e.target.value }))}
                                placeholder="EAAQ..."
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-indigo-500/20 transition-all font-bold"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Threads */}
                <Card className="hover:scale-[1.02] transition-all duration-500 border-2 border-zinc-500/20 hover:border-foreground/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] group rounded-3xl overflow-hidden bg-gradient-to-br from-background to-zinc-50/50 dark:to-zinc-900/10">
                    <CardHeader className="pb-4 border-b-2 border-border/50 bg-gradient-to-r from-zinc-500/5 to-transparent">
                        <CardTitle className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center text-white shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-500 text-xl font-black italic">TH</div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight">Threads</span>
                                <span className="text-[10px] text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-black italic opacity-80">Платформа Meta</span>
                            </div>
                        </CardTitle>
                        <CardDescription className="pl-1 text-sm font-medium">Публикация в профиль Threads.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8 px-8 pb-8">
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">ID пользователя</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] font-black uppercase tracking-wider gap-2 px-2 rounded-lg hover:bg-zinc-800 hover:text-white transition-all"
                                    onClick={handleFetchThreadsId}
                                    disabled={fetchingThreadsId || !apiKeys.th_access_token}
                                >
                                    <RefreshCw className={`w-3 h-3 ${fetchingThreadsId ? 'animate-spin' : ''}`} />
                                    Авто-ID
                                </Button>
                            </div>
                            <Input
                                value={apiKeys.th_user_id}
                                onChange={e => setApiKeys(prev => ({ ...prev, th_user_id: e.target.value }))}
                                placeholder="1784..."
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-zinc-800/20 transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Access Token</Label>
                            <Input
                                type="password"
                                value={apiKeys.th_access_token}
                                onChange={e => setApiKeys(prev => ({ ...prev, th_access_token: e.target.value }))}
                                placeholder="EAAQ..."
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-zinc-800/20 transition-all font-bold"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Twitter / X */}
                <Card className="hover:scale-[1.02] transition-all duration-500 border-2 border-zinc-800/20 hover:border-foreground/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.15)] group rounded-3xl overflow-hidden bg-gradient-to-br from-background to-zinc-50/50 dark:to-zinc-900/10">
                    <CardHeader className="pb-4 border-b-2 border-border/50 bg-gradient-to-r from-zinc-800/5 to-transparent">
                        <CardTitle className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center text-white shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-500 text-xl font-black italic whitespace-pre"> X </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight">Twitter / X</span>
                                <span className="text-[10px] text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-black italic opacity-80">Free Scraper API</span>
                            </div>
                        </CardTitle>
                        <CardDescription className="pl-1 text-sm font-medium">Бесплатная публикация через браузерную сессию.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-8 px-8 pb-8">
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Auth Token (Cookies)</Label>
                            <Input
                                type="password"
                                value={apiKeys.twitter_auth_token}
                                onChange={e => setApiKeys(prev => ({ ...prev, twitter_auth_token: e.target.value }))}
                                placeholder="auth_token=...; ct0=...;"
                                className="h-12 font-mono text-xs bg-background/50 border-2 rounded-xl focus:ring-zinc-800/20 transition-all font-bold"
                            />
                            <div className="flex items-center gap-2 pt-1 opacity-70">
                                <ExternalLink className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                                <p className="text-[10px] text-muted-foreground font-medium italic">Используйте X Auth Helper расширение.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tilda - Heavy Premium Style */}
                <Card className="md:col-span-2 hover:shadow-[0_40px_80px_rgba(249,115,22,0.15)] transition-all duration-700 border-2 border-orange-500/20 hover:border-orange-500/60 group overflow-hidden relative rounded-[2.5rem] bg-gradient-to-br from-background via-orange-50/20 to-orange-100/30 dark:via-orange-950/5 dark:to-orange-900/10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full -mr-48 -mt-48 blur-[100px] group-hover:bg-orange-500/20 transition-all duration-1000" />
                    <CardHeader className="pb-8 pt-10 px-10 border-b-2 border-orange-500/10 bg-gradient-to-r from-orange-500/5 via-orange-500/[0.02] to-transparent">
                        <CardTitle className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-[0_20px_40px_rgba(249,115,22,0.3)] group-hover:scale-110 group-hover:rotate-3 transition-all duration-700 font-serif text-3xl font-black italic">T</div>
                            <div className="flex flex-col gap-1">
                                <span className="text-3xl font-black tracking-tighter bg-gradient-to-r from-orange-600 to-orange-800 dark:from-orange-400 dark:to-orange-600 bg-clip-text text-transparent">Tilda Publishing</span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-[0.3em] font-black italic opacity-80">Основной портал</span>
                                    <div className="h-1 w-10 bg-orange-500/30 rounded-full" />
                                </div>
                            </div>
                        </CardTitle>
                        <CardDescription className="pl-[88px] text-lg font-medium italic opacity-70 font-serif leading-relaxed max-w-2xl">
                            Интеллектуальная синхронизация потоков через Feeds API.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-12 p-12 relative">
                        <div className="space-y-6">
                            <div className="space-y-3.5">
                                <Label className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2 opacity-60">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                    Сессия Tilda (Cookies)
                                </Label>
                                <Textarea
                                    value={apiKeys.tilda_cookies}
                                    onChange={e => setApiKeys(prev => ({ ...prev, tilda_cookies: e.target.value }))}
                                    placeholder="PHPSESSID=...; tilda_uid=..."
                                    className="font-mono text-xs min-h-[160px] p-6 bg-white/40 dark:bg-black/20 border-2 border-orange-500/10 rounded-[1.5rem] focus:ring-orange-500/20 focus:border-orange-500/40 transition-all resize-none shadow-inner leading-relaxed overflow-hidden"
                                />
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-500/5 border-2 border-orange-500/10 transition-all hover:bg-orange-500/10">
                                    <Info className="w-4 h-4 text-orange-600 shrink-0" />
                                    <p className="text-[10px] text-muted-foreground font-bold italic leading-tight">
                                        ID сессии из <span className="text-orange-600">DevTools</span>. Срок жизни обычно составляет 30 дней.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-10 py-2">
                            <div className="space-y-6">
                                <Label className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-60">Конфигурация инстанса</Label>
                                <div className="grid gap-6">
                                    <div className="relative group/input">
                                        <div className="absolute -left-3 -top-3 z-10 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950 text-[9px] font-black text-orange-600 dark:text-orange-400 border-2 border-orange-500/20 shadow-sm transition-all group-focus-within/input:scale-110 group-focus-within/input:bg-orange-500 group-focus-within/input:text-white uppercase tracking-tighter">PROJECT ID</div>
                                        <Input
                                            value={apiKeys.tilda_project_id}
                                            onChange={e => setApiKeys(prev => ({ ...prev, tilda_project_id: e.target.value }))}
                                            placeholder="7604066"
                                            className="h-14 font-mono text-sm pl-8 bg-white/40 dark:bg-black/20 border-2 border-orange-500/10 rounded-2xl transition-all focus:ring-orange-500/20 group-focus-within/input:border-orange-500/30"
                                        />
                                    </div>
                                    <div className="relative group/input">
                                        <div className="absolute -left-3 -top-3 z-10 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950 text-[9px] font-black text-orange-600 dark:text-orange-400 border-2 border-orange-500/20 shadow-sm transition-all group-focus-within/input:scale-110 group-focus-within/input:bg-orange-500 group-focus-within/input:text-white uppercase tracking-tighter">FEED UID</div>
                                        <Input
                                            value={apiKeys.tilda_feed_uid}
                                            onChange={e => setApiKeys(prev => ({ ...prev, tilda_feed_uid: e.target.value }))}
                                            placeholder="17511641..."
                                            className="h-14 font-mono text-sm pl-8 bg-white/40 dark:bg-black/20 border-2 border-orange-500/10 rounded-2xl transition-all focus:ring-orange-500/20 group-focus-within/input:border-orange-500/30"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex-1 rounded-[2rem] border-2 border-dashed border-orange-500/20 bg-gradient-to-br from-orange-500/[0.03] to-transparent p-6 flex flex-col items-center justify-center text-center group/status">
                                <div className="absolute -top-3 px-4 py-0.5 rounded-full bg-orange-50 text-[9px] font-black text-orange-500/50 uppercase tracking-widest border border-orange-500/10">Status</div>
                                <div className="text-xl font-bold bg-gradient-to-br from-orange-600 to-orange-800 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-500 italic">READY TO SYNC</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-50 mt-1 italic">V1.0.4.STABLE</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end pt-12 pb-20">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    size="lg"
                    className="h-14 px-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-2xl shadow-emerald-500/30 font-black text-lg transition-all duration-300 hover:scale-105 active:scale-95 gap-4"
                >
                    {saving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    СОХРАНИТЬ ВСЕ ИНТЕГРАЦИИ
                </Button>
            </div>
        </div>
    )
}
