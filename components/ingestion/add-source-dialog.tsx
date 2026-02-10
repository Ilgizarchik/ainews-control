'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Wand2, Loader2, Save, Play, Globe, Box, Link, Type, FileText, Image, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from '@/components/ui/premium-toasts'
import { scanUrlForSelectors, saveSource, testSelectors } from '@/app/actions/scan-source-actions'
import { Badge } from '@/components/ui/badge'

interface AddSourceDialogProps {
    source?: any // Optional source for editing
    trigger?: React.ReactNode // Custom trigger button
    onSuccess: () => void
}

export function AddSourceDialog({ source, trigger, onSuccess }: AddSourceDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [scanning, setScanning] = useState(false)

    // Form State - Pre-fill if editing
    const [name, setName] = useState(source?.name || '')
    const [url, setUrl] = useState(source?.url || '')
    const [type, setType] = useState<'rss' | 'html'>(source?.type || 'html')

    const [testResult, setTestResult] = useState<any>(null)
    const [testing, setTesting] = useState(false)

    // Selectors State
    const [selectors, setSelectors] = useState({
        container: source?.selectors?.container || '',
        title: source?.selectors?.title || '',
        link: source?.selectors?.link || '',
        summary: source?.selectors?.summary || '',
        date: source?.selectors?.date || '',
        image: source?.selectors?.image || '',
        date_detail: source?.selectors?.date_detail || ''
    })

    // Update state when dialog is opened (especially for edit mode)
    React.useEffect(() => {
        if (open && source) {
            setName(source.name || '')
            setUrl(source.url || '')
            setType(source.type || 'html')
            setSelectors({
                container: source.selectors?.container || '',
                title: source.selectors?.title || '',
                link: source.selectors?.link || '',
                summary: source.selectors?.summary || '',
                date: source.selectors?.date || '',
                image: source.selectors?.image || '',
                date_detail: source.selectors?.date_detail || ''
            })
        } else if (open && !source) {
            resetForm()
        }
    }, [open, source])

    // AI Scanning Toast Logic
    React.useEffect(() => {
        if (!scanning) return;

        const msgs = [
            "Так, зашел на сайт, смотрю данные...",
            "Опа, что я тут вижу!",
            "Сейчас все вытащим...",
            "Так так так, где же тут дата...",
            "Хмммм, картинки нет что ли...",
            "Почти закончил..."
        ]

        const toastId = 'scanning-url-selectors';
        toast.loading(msgs[0], { id: toastId });

        let i = 0
        const interval = setInterval(() => {
            i++
            if (i < msgs.length) {
                toast.loading(msgs[i], { id: toastId })
            }
        }, 3000)

        return () => {
            clearInterval(interval);
            // Dismiss toast on cleanup or unmount
            toast.dismiss(toastId);
        }
    }, [scanning])


    const handleScan = async () => {
        if (!url) {
            toast.error('Введите URL')
            return
        }

        const toastId = 'scanning-url-selectors';
        setScanning(true)
        try {
            const res = await scanUrlForSelectors(url)
            if (res.success && res.selectors) {
                setSelectors({
                    container: res.selectors.container || '',
                    title: res.selectors.title || '',
                    link: res.selectors.link || '',
                    summary: res.selectors.summary || '',
                    date: res.selectors.date || '',
                    image: res.selectors.image || '',
                    date_detail: res.selectors.date_detail || ''
                })

                // Auto-guess name if empty
                if (!name) {
                    try {
                        const hostname = new URL(url).hostname.replace('www.', '')
                        setName(hostname.charAt(0).toUpperCase() + hostname.slice(1))
                    } catch { }
                }

                toast.success('Селекторы определены!', { id: toastId })
            } else {
                toast.error(`Ошибка: ${res.error}`, { id: toastId })
            }
        } catch {
            toast.error('Ошибка сканирования', { id: toastId })
        } finally {
            setScanning(false)
        }
    }

    const handleSave = async () => {
        if (!name || !url) {
            toast.error('Название и URL обязательны')
            return
        }
        if (type === 'html' && !selectors.container) {
            toast.error('Селектор контейнера обязателен для HTML')
            return
        }

        setLoading(true)
        const payload: any = {
            name,
            url,
            type,
            selectors: type === 'html' ? {
                ...selectors,
                // Preserve legacy_parser if it exists and we haven't overwritten with new scan
                ...(source?.selectors?.legacy_parser && !scanning && !testResult ? { legacy_parser: source.selectors.legacy_parser } : {})
            } : {},
            is_active: source ? source.is_active : true
        }

        // Clean up empty strings or 'null' values from selectors to keep DB clean
        if (payload.selectors && typeof payload.selectors === 'object') {
            Object.keys(payload.selectors).forEach(key => {
                if (payload.selectors[key] === '') delete payload.selectors[key]
            })
        }

        if (source?.id) {
            payload.id = source.id
        }

        const res = await saveSource(payload)
        setLoading(false)

        if (res.success) {
            toast.success(source ? 'Источник обновлен' : 'Источник добавлен')
            setOpen(false)
            if (!source) resetForm()
            onSuccess()
        } else {
            toast.error(`Ошибка сохранения: ${res.error}`)
        }
    }

    const handleTest = async () => {
        if (!url || !selectors.container) {
            toast.error('Нужен URL и селектор контейнера')
            return
        }
        setTesting(true)
        setTestResult(null)
        const res = await testSelectors(url, selectors)
        setTesting(false)
        if (res.success) {
            setTestResult(res.items)
            toast.success('Тест завершен')
        } else {
            toast.error('Ошибка теста: ' + res.error)
        }
    }

    const resetForm = () => {
        setName('')
        setUrl('')
        setType('html')
        setSelectors({ container: '', title: '', link: '', summary: '', date: '', image: '', date_detail: '' })
        setTestResult(null)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        size="sm"
                        className="gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg transition-all hover:scale-105 active:scale-95 font-bold"
                    >
                        <Plus className="w-4 h-4" /> Добавить источник
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto rounded-[2.5rem] border-2 border-border/50 shadow-2xl p-0 gap-0 animate-in fade-in zoom-in-95 duration-500">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-[80px] pointer-events-none" />

                <DialogHeader className="p-10 pb-6 border-b-2 border-border/50 bg-gradient-to-r from-muted/30 via-background to-background relative">
                    <DialogTitle className="text-3xl font-black tracking-tight flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl text-white">
                            <Globe className="w-6 h-6" />
                        </div>
                        {source ? 'Редактировать источник' : 'Новый источник'}
                    </DialogTitle>
                    <DialogDescription className="text-base font-medium mt-2 pl-16">
                        {source
                            ? 'Измените параметры сканирования или обновите селекторы данных.'
                            : 'Настройте новый канал для автоматического сбора новостей.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-10 space-y-8 relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 pl-1">Тип источника</Label>
                            <Select value={type} onValueChange={(v: any) => setType(v)}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 bg-background/50 font-bold text-sm shadow-sm hover:border-primary/30 transition-all focus:ring-primary/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-2 shadow-2xl">
                                    <SelectItem value="rss" className="rounded-xl m-1 font-bold">RSS Лента</SelectItem>
                                    <SelectItem value="html" className="rounded-xl m-1 font-bold">HTML Страница (Скрапинг)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 pl-1">Название проекта</Label>
                            <Input
                                placeholder="например, Outdoor News"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="h-14 rounded-2xl border-2 bg-background/50 font-bold text-sm shadow-inner transition-all focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 pl-1">URL адрес</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 group">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-30 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
                                <Input
                                    placeholder={type === 'rss' ? "https://site.com/rss.xml" : "https://site.com/latest/"}
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    className="h-14 pl-12 rounded-2xl border-2 bg-background/50 font-medium text-sm shadow-inner transition-all focus:ring-primary/20"
                                />
                            </div>
                            {type === 'html' && (
                                <Button
                                    onClick={handleScan}
                                    disabled={scanning || !url}
                                    className="h-14 px-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/20 font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 gap-3"
                                >
                                    {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                    AI Скан
                                </Button>
                            )}
                        </div>
                    </div>

                    {type === 'html' && (
                        <div className="space-y-6 rounded-[2rem] p-8 bg-slate-500/[0.03] dark:bg-slate-100/[0.03] border-2 border-dashed border-border/50 relative overflow-hidden group/selectors">
                            <div className="flex flex-col gap-2 relative z-10">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                                            <Wand2 className="w-4 h-4" />
                                        </div>
                                        <h4 className="font-black text-sm uppercase tracking-widest">CSS Селекторы</h4>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-background/50">SMART INGESTION</Badge>
                                </div>

                                {source?.selectors?.legacy_parser && !testResult && (
                                    <div className="p-4 bg-blue-500/5 border-2 border-blue-500/20 rounded-2xl text-[11px] text-blue-700 dark:text-blue-400 flex items-start gap-3 mb-4 animate-in slide-in-from-top-2 duration-500">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div className="font-bold leading-relaxed">
                                            Этот источник использует <span className="underline decoration-2 underline-offset-2">встроенный парсер</span> (Legacy).
                                            CSS селекторы не обязательны, пока вы не нажмете «AI Скан» для перехода на современный движок.
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                {[
                                    { label: 'Контейнер (Цикл)', key: 'container', icon: Box, placeholder: '.post-items div' },
                                    { label: 'Ссылка (href)', key: 'link', icon: Link, placeholder: 'a.title' },
                                    { label: 'Заголовок (Text)', key: 'title', icon: Type, placeholder: 'h2.title' },
                                    { label: 'Описание (Text)', key: 'summary', icon: FileText, placeholder: 'p.description' },
                                    { label: 'Изображение (src)', key: 'image', icon: Image, placeholder: 'img.thumb' },
                                    { label: 'Дата (Список)', key: 'date', icon: Calendar, placeholder: 'time.published' },
                                    { label: 'Дата (Статья)', key: 'date_detail', icon: Calendar, placeholder: 'time.entry-date' },
                                ].map((field) => (
                                    <div key={field.key} className="space-y-2 group/field">
                                        <div className="flex items-center gap-2 pl-1">
                                            <field.icon className="w-3.5 h-3.5 text-muted-foreground opacity-50 group-focus-within/field:text-indigo-500 transition-colors" />
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{field.label}</Label>
                                        </div>
                                        <Input
                                            className="h-12 rounded-xl border-2 bg-background/50 font-mono text-xs shadow-sm transition-all focus:ring-indigo-500/10 focus:border-indigo-500/30 font-bold"
                                            placeholder={field.placeholder}
                                            value={(selectors as any)[field.key]}
                                            onChange={e => setSelectors({ ...selectors, [field.key]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {testResult && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 pl-1 flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Структура данных (JSON)
                                </Label>
                                <div className="p-6 bg-slate-950 dark:bg-black text-emerald-400 rounded-3xl text-[11px] font-mono overflow-auto max-h-[350px] border-2 border-emerald-500/20 shadow-2xl custom-scrollbar">
                                    <pre className="opacity-90">{JSON.stringify(testResult, null, 2)}</pre>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 pl-1 flex items-center gap-2">
                                    <Play className="w-3.5 h-3.5" /> Визуальное превью
                                </Label>
                                <div className="p-8 bg-background border-2 border-border/50 rounded-3xl h-[350px] overflow-auto shadow-inner relative group/preview">
                                    {testResult[0] && (
                                        <div className="space-y-4">
                                            <div className="inline-flex px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                                                Первый найденный пост
                                            </div>
                                            <h3 className="text-xl font-black text-foreground leading-tight group-hover/preview:text-indigo-600 transition-colors">{testResult[0].title}</h3>
                                            <p className="text-[10px] font-mono text-muted-foreground/60 break-all bg-muted/50 p-2 rounded-lg border border-border/50">{testResult[0].link}</p>
                                            <div className="h-px bg-gradient-to-r from-border/0 via-border/50 to-border/0 my-4" />
                                            {testResult[0].previewText ? (
                                                <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">
                                                    «{testResult[0].previewText}»
                                                </p>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 gap-4">
                                                    <Loader2 className="w-8 h-8 animate-spin" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Извлечение контента...</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-10 pt-6 border-t-2 border-border/50 bg-muted/20">
                    <div className="flex flex-col sm:flex-row w-full justify-between items-center gap-6">
                        {type === 'html' && (
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={handleTest}
                                disabled={testing || scanning}
                                className="w-full sm:w-auto h-14 px-10 rounded-2xl border-2 hover:bg-background font-black text-xs uppercase tracking-[0.15em] gap-3 shadow-sm transition-all active:scale-95"
                            >
                                {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 text-indigo-500" />}
                                Проверить селекторы
                            </Button>
                        )}
                        <div className="flex gap-4 w-full sm:w-auto">
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="flex-1 sm:flex-none h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest opacity-60 hover:opacity-100"
                            >
                                Отмена
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-1 sm:flex-none h-14 px-10 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/20 font-black text-xs uppercase tracking-[0.15em] gap-3 transition-all hover:scale-105 active:scale-95"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {source ? 'Обновить проект' : 'Запустить источник'}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
