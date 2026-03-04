'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Download, Trash2, Database, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createSystemBackup, getRecentBackups, deleteBackup } from '@/app/actions/maintenance-actions'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export function MaintenanceTab() {
    const [isCreating, setIsCreating] = useState(false)
    const [backups, setBackups] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchBackups = async () => {
        setLoading(true)
        try {
            const result = await getRecentBackups()
            if (result.success) {
                setBackups(result.backups || [])
            } else {
                toast.error(`Не удалось загрузить список бэкапов: ${result.error ?? 'неизвестная ошибка'}`)
                setBackups([])
            }
        } catch (e: any) {
            toast.error(`Критическая ошибка при загрузке бэкапов: ${e.message}`)
            setBackups([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBackups()
    }, [])

    const handleCreateBackup = async () => {
        setIsCreating(true)
        toast.info('🚀 Запуск процесса бэкапа. Это может занять пару минут...', { duration: 5000 })

        try {
            const result = await createSystemBackup()
            if (result.success) {
                toast.success('✨ Резервная копия успешно создана!')
                fetchBackups()
            } else {
                toast.error(`Ошибка при создании бэкапа: ${result.error}`)
            }
        } catch (e: any) {
            toast.error(`Критическая ошибка: ${e.message}`)
        } finally {
            setIsCreating(false)
        }
    }

    const handleDelete = async (filename: string) => {
        if (!confirm('Вы уверены, что хотите удалить этот бэкап?')) return

        const result = await deleteBackup(filename)
        if (result.success) {
            toast.success('Удалено')
            fetchBackups()
        } else {
            toast.error(`Ошибка: ${result.error}`)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Backup Actions */}
                <Card className="border-2 rounded-3xl overflow-hidden shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500 rounded-xl text-white">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black italic">Резервное копирование</CardTitle>
                                <CardDescription className="font-medium">Создание полного слепка системы и баз данных</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 flex items-start gap-4">
                            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                            <div className="text-sm">
                                <p className="font-bold text-amber-900 dark:text-amber-200 mb-1">Что входит в бэкап?</p>
                                <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-1 opacity-80">
                                    <li>Полный дамп базы Supabase</li>
                                    <li>Конфигурационные файлы (.env)</li>
                                    <li>Исходный код проекта</li>
                                </ul>
                            </div>
                        </div>

                        <Button
                            onClick={handleCreateBackup}
                            disabled={isCreating}
                            className="w-full h-16 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                                    Создается копия...
                                </>
                            ) : (
                                <>
                                    <Database className="w-6 h-6 mr-3" />
                                    Создать бэкап сейчас
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Recent Backups */}
                <Card className="border-2 rounded-3xl overflow-hidden shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b-2">
                        <CardTitle className="text-2xl font-black italic">Последние копии</CardTitle>
                        <CardDescription className="font-medium">Список доступных для скачивания архивов</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-10 opacity-50">
                                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                                <p className="font-bold">Загрузка списка...</p>
                            </div>
                        ) : backups.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed rounded-3xl border-muted">
                                <p className="text-muted-foreground font-medium italic">Бэкапов пока нет</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {backups.map((backup) => (
                                    <div
                                        key={backup.name}
                                        className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border-2 border-border/50 hover:border-primary/20 transition-all group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm truncate max-w-[200px]">{backup.name}</span>
                                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                                {formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true, locale: ru })} • {formatSize(backup.size)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                asChild
                                                className="w-10 h-10 rounded-xl"
                                            >
                                                <a href={backup.url} download>
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(backup.name)}
                                                className="w-10 h-10 rounded-xl text-rose-500 hover:bg-rose-500 hover:text-white"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
