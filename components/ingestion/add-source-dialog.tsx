'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Wand2, Loader2, Save, Play } from 'lucide-react'
import { toast } from 'sonner'
import { scanUrlForSelectors, saveSource, testSelectors } from '@/app/actions/scan-source-actions'
import { Switch } from '@/components/ui/switch'

interface AddSourceDialogProps {
    onSuccess: () => void
}

export function AddSourceDialog({ onSuccess }: AddSourceDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [scanning, setScanning] = useState(false)

    // Form State
    const [name, setName] = useState('')
    const [url, setUrl] = useState('')
    const [type, setType] = useState<'rss' | 'html'>('html')

    const [testResult, setTestResult] = useState<any>(null)
    const [testing, setTesting] = useState(false)

    // Selectors State
    const [selectors, setSelectors] = useState({
        container: '',
        title: '',
        link: '',
        summary: '',
        date: '',
        image: ''
    })

    const handleScan = async () => {
        if (!url) {
            toast.error('Введите URL')
            return
        }

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
                    image: res.selectors.image || ''
                })

                // Auto-guess name if empty
                if (!name) {
                    try {
                        const hostname = new URL(url).hostname.replace('www.', '')
                        setName(hostname.charAt(0).toUpperCase() + hostname.slice(1))
                    } catch (e) { }
                }

                toast.success('Селекторы определены!')
            } else {
                toast.error(`Ошибка сканирования: ${res.error}`)
            }
        } catch (e) {
            toast.error('Ошибка сканирования')
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
        const payload = {
            name,
            url,
            type,
            selectors: type === 'html' ? selectors : {},
            is_active: true
        }

        const res = await saveSource(payload)
        setLoading(false)

        if (res.success) {
            toast.success('Источник добавлен')
            setOpen(false)
            resetForm()
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
        setSelectors({ container: '', title: '', link: '', summary: '', date: '', image: '' })
        setTestResult(null)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" /> Добавить источник
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Добавить новостной источник</DialogTitle>
                    <DialogDescription>
                        Настройте новый источник для сбора. Используйте AI сканирование для HTML сайтов.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Тип источника</Label>
                            <Select value={type} onValueChange={(v: any) => setType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="rss">RSS Лента</SelectItem>
                                    <SelectItem value="html">HTML Страница (Скрапинг)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Название</Label>
                            <Input placeholder="например, Мой Блог" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>URL</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder={type === 'rss' ? "https://site.com/rss.xml" : "https://site.com/news"}
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                            />
                            {type === 'html' && (
                                <Button
                                    variant="secondary"
                                    onClick={handleScan}
                                    disabled={scanning || !url}
                                    title="Авто-определение селекторов через AI"
                                >
                                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-purple-500" />}
                                    <span className="ml-2 hidden sm:inline">Авто-Скан</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {type === 'html' && (
                        <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm">CSS Селекторы</h4>
                                <span className="text-xs text-muted-foreground">AI может заполнить их автоматически</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Контейнер (Цикл)</Label>
                                    <Input
                                        className="font-mono text-xs"
                                        placeholder=".news-item"
                                        value={selectors.container}
                                        onChange={e => setSelectors({ ...selectors, container: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Ссылка (href)</Label>
                                    <Input
                                        className="font-mono text-xs"
                                        placeholder="a.title-link"
                                        value={selectors.link}
                                        onChange={e => setSelectors({ ...selectors, link: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Заголовок (Text)</Label>
                                    <Input
                                        className="font-mono text-xs"
                                        placeholder="h3"
                                        value={selectors.title}
                                        onChange={e => setSelectors({ ...selectors, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Описание (Text)</Label>
                                    <Input
                                        className="font-mono text-xs"
                                        placeholder=".description"
                                        value={selectors.summary}
                                        onChange={e => setSelectors({ ...selectors, summary: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Изображение (src)</Label>
                                    <Input
                                        className="font-mono text-xs"
                                        placeholder="img.thumb"
                                        value={selectors.image}
                                        onChange={e => setSelectors({ ...selectors, image: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Дата (Text) - Опционально</Label>
                                    <Input
                                        className="font-mono text-xs"
                                        placeholder=".date"
                                        value={selectors.date}
                                        onChange={e => setSelectors({ ...selectors, date: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {testResult && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Превью ленты (3 элемента)</Label>
                                <div className="p-3 bg-slate-950 text-slate-50 rounded-md text-xs font-mono overflow-auto max-h-[300px] border border-slate-800">
                                    <pre>{JSON.stringify(testResult, null, 2)}</pre>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">Проверка контента (Первый элемент)</Label>
                                <div className="p-3 bg-muted rounded-md text-xs h-[300px] overflow-auto border">
                                    {testResult[0] && (
                                        <>
                                            <p className="font-semibold mb-2 text-primary truncate">{testResult[0].title}</p>
                                            <p className="text-muted-foreground mb-2 break-all text-[10px]">{testResult[0].link}</p>
                                            {testResult[0].previewText ? (
                                                <p className="whitespace-pre-wrap text-foreground/80 leading-relaxed">
                                                    {testResult[0].previewText}
                                                </p>
                                            ) : (
                                                <div className="flex items-center justify-center h-40 text-muted-foreground">
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Получение контента...
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <div className="flex w-full justify-between">
                        {type === 'html' && (
                            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || scanning}>
                                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Тест селекторов
                            </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
                            <Button onClick={handleSave} disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Сохранить источник
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    )
}
