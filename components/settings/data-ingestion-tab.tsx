'use client'

import React, { useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { RefreshCw, Play, Globe, Rss, FileText, Settings2, Trash2, SwitchCamera, Clock, Save } from 'lucide-react'
import { toast } from '@/components/ui/premium-toasts'
import { triggerIngestion } from '@/app/actions/ingest-actions'
import { toggleSourceActive, deleteSource } from '@/app/actions/scan-source-actions'
import { AddSourceDialog } from '@/components/ingestion/add-source-dialog'
import type { IngestSchedule } from '@/components/settings/types'

interface DataIngestionTabProps {
    autoIngestion: boolean
    setAutoIngestion: (v: boolean) => void
    safePublishMode: boolean
    setSafePublishMode: (v: boolean) => void
    ingestSchedule: IngestSchedule
    setIngestSchedule: React.Dispatch<React.SetStateAction<IngestSchedule>>
    allSources: any[]
    ingestionConfig: any
    setIngestionConfig: (v: any) => void
    dbSources: any[]
    setDbSources: React.Dispatch<React.SetStateAction<any[]>>
    loading: boolean
    saving: boolean
    ingestionRunning: boolean
    setIngestionRunning: (v: boolean) => void
    fetchSettings: () => void
    handleSave: () => void
    updateSingleSetting: (key: string, value: string) => void
}

export function DataIngestionTab({
    autoIngestion,
    setAutoIngestion,
    safePublishMode,
    setSafePublishMode,
    ingestSchedule,
    setIngestSchedule,
    allSources,
    ingestionConfig,
    setIngestionConfig,
    dbSources,
    setDbSources,
    loading: _loading,
    saving,
    ingestionRunning,
    setIngestionRunning,
    fetchSettings,
    handleSave,
    updateSingleSetting
}: DataIngestionTabProps) {
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const activeToastId = 'manual-ingestion-scanner'

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
            toast.dismiss(activeToastId)
        }
    }, [])

    const handleRunScanner = async () => {
        setIngestionRunning(true)
        toast.loading("Так-с, что тут у нас в интернетах...", { id: activeToastId })

        // Helper to dispatch logs to WittyBot
        const dispatchLog = (text: string, type: 'info' | 'thinking' | 'success' | 'error' = 'info') => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('witty-log', { detail: { text, type } }))
            }
        }

        dispatchLog("Запускаю свои цифровые щупальца 🐙", "info")

        // Funny messages sequence
        const msgs = [
            "Погнали искать свежие новости!",
            "Опа, свежак подъехал?!",
            "В копилку знаний! 📚",
            "Почти закончил..."
        ]
        let i = 0
        intervalRef.current = setInterval(() => {
            if (i < msgs.length) {
                const msg = msgs[i]
                toast.loading(msg, { id: activeToastId })
                dispatchLog(msg, i % 2 === 0 ? "thinking" : "info")
                i++
            }
        }, 3000)

        try {
            const activeIds = allSources
                .filter(s => {
                    const cfg = ingestionConfig[s.id]
                    return cfg ? cfg.isActive : s.isActive
                })
                .map(s => s.id)

            const res = await triggerIngestion(activeIds)

            if (intervalRef.current) clearInterval(intervalRef.current)

            if (res.success && res.data) {
                const successMsg = `Готово! Добавлено: ${res.data.newInserted}`
                toast.success(successMsg, { id: activeToastId })
                dispatchLog(successMsg, "success")
            } else {
                const errorMsg = 'Ошибка: ' + res.error
                toast.error(errorMsg, { id: activeToastId })
                dispatchLog(errorMsg, "error")
            }
        } catch (e: any) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            toast.error('Критическая ошибка запуска', { id: activeToastId })
            dispatchLog('Критическая ошибка запуска', "error")
        } finally {
            setIngestionRunning(false)
        }
    }

    return (
        <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Global Automation Switchers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card data-tutorial="settings-ingestion-toggle" className="border-2 border-emerald-500/20 shadow-lg rounded-3xl overflow-hidden relative group bg-gradient-to-br from-background to-emerald-50/30 dark:to-emerald-900/10">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-3 text-xl font-black">
                            <div className={`p-2 rounded-xl transition-all duration-500 ${autoIngestion ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg text-white' : 'bg-muted text-muted-foreground'}`}>
                                <RefreshCw className={`w-5 h-5 ${autoIngestion ? 'animate-spin-slow' : ''}`} />
                            </div>
                            Авто-сбор (Ingestion)
                        </CardTitle>
                        <CardDescription className="font-medium">Глобальное включение крона для мониторинга новостей.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between p-8 pt-2">
                        <span className={`text-sm font-black uppercase tracking-widest ${autoIngestion ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground opacity-50'}`}>
                            {autoIngestion ? 'Система Активна' : 'Сбор Остановлен'}
                        </span>
                        <Switch
                            checked={autoIngestion}
                            onCheckedChange={(checked) => {
                                setAutoIngestion(checked)
                                updateSingleSetting('auto_ingestion', String(checked))
                            }}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    </CardContent>
                </Card>

                <Card data-tutorial="settings-safe-mode" className="border-2 border-orange-500/20 shadow-lg rounded-3xl overflow-hidden relative group bg-gradient-to-br from-background to-orange-50/30 dark:to-orange-900/10">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-3 text-xl font-black text-orange-600 dark:text-orange-500">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg text-white">
                                <SwitchCamera className="w-5 h-5" />
                            </div>
                            Safe Mode
                        </CardTitle>
                        <CardDescription className="font-medium">Симуляция публикации без отправки в реальные соцсети.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between p-8 pt-2">
                        <span className="text-sm font-black uppercase tracking-widest text-orange-600/80">
                            {safePublishMode ? 'Режим Симуляции' : 'Реальный Постинг'}
                        </span>
                        <Switch
                            checked={safePublishMode}
                            onCheckedChange={(checked) => {
                                setSafePublishMode(checked)
                                updateSingleSetting('safe_publish_mode', String(checked))
                            }}
                            className="data-[state=checked]:bg-orange-500"
                        />
                    </CardContent>
                </Card>
            </div>

            {/* 1. Schedule & Control */}
            <Card data-tutorial="settings-schedule" className="border-2 border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-background via-slate-50/50 to-slate-100/50 dark:via-slate-900/10 dark:to-slate-950/20">
                <CardHeader className="pb-8 pt-10 px-10 border-b-2 border-border/50">
                    <div className="flex items-center justify-between gap-6">
                        <div className="space-y-1.5">
                            <CardTitle className="text-2xl font-black tracking-tight">Расписание автоматизации</CardTitle>
                            <CardDescription className="text-base font-medium">Тонкая настройка циклов проверки новых материалов.</CardDescription>
                        </div>
                        <Button
                            size="lg"
                            className="h-14 px-8 rounded-2xl bg-slate-900 dark:bg-slate-100 text-slate-100 dark:text-slate-900 hover:scale-105 transition-all duration-300 shadow-xl font-black text-sm uppercase tracking-widest gap-3"
                            onClick={handleRunScanner}
                            disabled={ingestionRunning || saving}
                        >
                            {ingestionRunning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                            Запустить Сканер
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                    <div className="flex flex-col md:flex-row gap-8 items-stretch md:items-end">
                        <div className="flex-1 space-y-3.5">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Режим запуска</Label>
                            <Select
                                value={ingestSchedule.mode}
                                onValueChange={(v) => setIngestSchedule({ ...ingestSchedule, mode: v })}
                            >
                                <SelectTrigger className="h-14 rounded-2xl border-2 bg-background/50 shadow-inner font-bold text-base transition-all focus:ring-emerald-500/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                    <SelectItem value="interval" className="rounded-xl m-1 cursor-pointer font-bold">С фиксированным интервалом</SelectItem>
                                    <SelectItem value="daily" className="rounded-xl m-1 cursor-pointer font-bold font-serif">Ежедневно (Time Trigger)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {ingestSchedule.mode === 'interval' && (
                            <div className="flex-1 space-y-3.5 animate-in slide-in-from-left-4 duration-500">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Интервал ожидания</Label>
                                <Select
                                    value={ingestSchedule.value}
                                    onValueChange={(v) => setIngestSchedule({ ...ingestSchedule, value: v })}
                                >
                                    <SelectTrigger className="h-14 rounded-2xl border-2 bg-background/50 shadow-inner font-bold text-base transition-all focus:ring-emerald-500/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                        <SelectItem value="15" className="rounded-xl m-1 cursor-pointer">⚡ Экспресс (15 мин)</SelectItem>
                                        <SelectItem value="30" className="rounded-xl m-1 cursor-pointer">🚀 Динамичный (30 мин)</SelectItem>
                                        <SelectItem value="60" className="rounded-xl m-1 cursor-pointer font-bold">💎 Стандарт (1 час)</SelectItem>
                                        <SelectItem value="180" className="rounded-xl m-1 cursor-pointer">📦 Консервативно (3 ч)</SelectItem>
                                        <SelectItem value="360" className="rounded-xl m-1 cursor-pointer">🕰 Редко (6 ч)</SelectItem>
                                        <SelectItem value="720" className="rounded-xl m-1 cursor-pointer opacity-70">🌑 Ночной (12 ч)</SelectItem>
                                        <SelectItem value="1440" className="rounded-xl m-1 cursor-pointer opacity-50">📅 Суточный (24 ч)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {ingestSchedule.mode === 'daily' && (
                            <div className="flex-1 space-y-3.5 animate-in slide-in-from-left-4 duration-500">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Точное время (UTC)</Label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-4.5 h-5 w-5 text-muted-foreground opacity-30" />
                                    <Input
                                        type="time"
                                        value={ingestSchedule.value}
                                        onChange={(e) => setIngestSchedule({ ...ingestSchedule, value: e.target.value })}
                                        className="h-14 pl-12 rounded-2xl border-2 bg-background/50 shadow-inner font-black text-lg transition-all focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="md:w-auto">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="h-14 px-10 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/20 font-black text-sm uppercase tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 gap-3"
                            >
                                {saving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                Применить
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Sources List */}
            <Card data-tutorial="settings-sources" className="border-2 border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden bg-background relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-[80px] group-hover:bg-primary/10 transition-all duration-1000" />
                <CardHeader className="flex flex-row items-center justify-between p-10 border-b-2 border-border/50 bg-gradient-to-r from-muted/50 via-background to-background relative">
                    <div className="space-y-2">
                        <CardTitle className="flex items-center gap-4 text-2xl font-black tracking-tight">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl text-white">
                                <Globe className="w-6 h-6" />
                            </div>
                            Активные источники
                        </CardTitle>
                        <CardDescription className="text-base font-medium pl-14">
                            Управление RSS лентами, Telegram каналами и веб-скраперами.
                        </CardDescription>
                    </div>
                    <div className="hover:scale-105 transition-transform duration-300">
                        <AddSourceDialog onSuccess={() => fetchSettings()} />
                    </div>
                </CardHeader>
                <CardContent className="p-0 relative">
                    <div className="divide-y divide-border/50">
                        {allSources.map(source => {
                            const isConfigured = ingestionConfig[source.id]
                            const isActive = isConfigured ? isConfigured.isActive : source.isActive
                            const Icon = source.type === 'rss' ? Rss : (source.id.includes('orders') ? FileText : Globe)

                            return (
                                <div key={source.id} className="flex items-center justify-between p-8 hover:bg-slate-500/[0.02] dark:hover:bg-slate-100/[0.02] transition-colors group/item">
                                    <div className="flex items-center gap-6 overflow-hidden">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-sm ${isActive ? 'bg-primary/10 border-primary/30 text-primary group-hover/item:scale-110 group-hover/item:rotate-3' : 'bg-muted/50 border-muted text-muted-foreground/50 opacity-60'}`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-3">
                                                <p className="font-black text-lg text-foreground group-hover/item:text-primary transition-colors tracking-tight">{source.name}</p>
                                                {source.is_custom && (
                                                    <div className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/20 shadow-sm">Custom</div>
                                                )}
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-border/50 uppercase tracking-[0.15em] opacity-40`}>
                                                    {source.type || 'WEB'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate max-w-[500px] font-mono font-medium opacity-60">
                                                <a href={source.url} target="_blank" className="hover:text-primary hover:underline hover:underline-offset-4 transition-all">
                                                    {source.url}
                                                </a>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8 pl-4">
                                        <div className="flex flex-col items-end gap-1.5 pr-2">
                                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${isActive ? 'text-emerald-500' : 'text-muted-foreground/30 font-bold italic'}`}>
                                                {isActive ? 'Система в работе' : 'Приостановлено'}
                                            </span>
                                            <Switch
                                                checked={isActive}
                                                onCheckedChange={async (checked: boolean) => {
                                                    if (source.is_custom) {
                                                        const res = await toggleSourceActive(source.id, checked)
                                                        if (res.success) {
                                                            setDbSources(prev => prev.map(s => s.id === source.id ? { ...s, is_active: checked } : s))
                                                            toast.success(checked ? 'Источник активирован' : 'Источник на паузе')
                                                        } else {
                                                            toast.error('Ошибка синхронизации')
                                                        }
                                                    } else {
                                                        const newIngestionConfig = {
                                                            ...ingestionConfig,
                                                            [source.id]: { isActive: checked }
                                                        }
                                                        setIngestionConfig(newIngestionConfig)
                                                        updateSingleSetting('ingestion_config', JSON.stringify(newIngestionConfig))
                                                    }
                                                }}
                                                className="data-[state=checked]:bg-emerald-500 h-6 w-11 shadow-inner"
                                            />
                                        </div>
                                        {source.is_custom && (
                                            <div className="flex items-center gap-2 border-l-2 border-border/50 pl-6 h-10 py-1">
                                                <AddSourceDialog
                                                    source={dbSources.find(s => s.id === source.id)}
                                                    onSuccess={() => fetchSettings()}
                                                    trigger={
                                                        <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground/50 hover:text-indigo-600 hover:bg-indigo-500/10 transition-all rounded-[1.25rem] border-2 border-transparent hover:border-indigo-500/20">
                                                            <Settings2 className="w-5 h-5" />
                                                        </Button>
                                                    }
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-11 w-11 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-all rounded-[1.25rem] border-2 border-transparent hover:border-red-500/20"
                                                    onClick={async () => {
                                                        if (confirm('Вы действительно хотите удалить этот источник?')) {
                                                            await deleteSource(source.id)
                                                            await fetchSettings()
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t-2 border-border/50 py-5 px-10 flex justify-between items-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 italic">
                    <span>Всего источников: {allSources.length}</span>
                    <span>Мониторинг 24/7</span>
                </CardFooter>
            </Card>
        </div>
    )
}
