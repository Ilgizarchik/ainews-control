'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Terminal, Calendar, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type LogItem = {
    id: string
    created_at: string
    instruction: string
    original_text_snippet: string
    context: string
    news_id: string | null
    review_id: string | null
    news_items?: { title?: string, draft_title?: string }
    review_items?: { draft_title?: string }
}

export function AiCorrectionLogs() {
    const [logs, setLogs] = useState<LogItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const supabase = createClient()

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('ai_correction_logs')
                .select(`
                    *,
                    news_items (draft_title, title),
                    review_items (draft_title)
                `)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) {
                console.error('Supabase Fetch Error:', error)
                throw new Error(error.message)
            }

            setLogs(data as any[])
        } catch (e: any) {
            console.error('Failed to fetch logs:', e.message || e)
            toast.error('Не удалось загрузить историю')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    const filteredLogs = logs.filter(log =>
        log.instruction.toLowerCase().includes(search.toLowerCase()) ||
        (log.news_items?.title || log.news_items?.draft_title || '').toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Card className="border-none shadow-none bg-transparent animate-in fade-in slide-in-from-bottom-6 duration-700">
            <CardHeader className="px-0 pt-0 pb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-4 text-3xl font-black tracking-tight">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl text-white">
                                <Terminal className="w-6 h-6" />
                            </div>
                            История правок AI
                        </CardTitle>
                        <CardDescription className="text-base font-medium pl-14">
                            Аудит всех изменений, внесенных нейросетью в контент
                        </CardDescription>
                    </div>
                    <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-40 group-focus-within:text-purple-500 group-focus-within:opacity-100 transition-all duration-300" />
                        <Input
                            placeholder="Поиск по инструкциям..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-14 pl-12 pr-4 rounded-2xl bg-background/50 border-2 border-border/50 focus:border-purple-500/50 focus:ring-purple-500/10 transition-all duration-300 font-bold shadow-inner"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="rounded-[2.5rem] border-2 border-border/50 bg-background shadow-2xl overflow-hidden relative group/container">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full -mr-32 -mt-32 blur-[80px] group-hover/container:bg-purple-500/10 transition-all duration-1000" />
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                                <Loader2 className="w-12 h-12 animate-spin text-purple-600 relative" />
                            </div>
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Синхронизация данных...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center px-4 relative">
                            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-muted/50 to-muted/10 flex items-center justify-center mb-6 shadow-inner border-2 border-border/50">
                                <Terminal className="w-10 h-10 text-muted-foreground/30" />
                            </div>
                            <h3 className="text-xl font-black text-foreground tracking-tight">История пуста</h3>
                            <p className="text-sm font-medium text-muted-foreground max-w-[300px] mt-2 leading-relaxed">
                                Записи появятся автоматически после того, как AI агент внесет первые правки в ваши материалы.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y-2 divide-border/50">
                            {filteredLogs.map((log) => {
                                const newsTitle = log.news_items?.draft_title || log.news_items?.title
                                const reviewTitle = log.review_items?.draft_title
                                const title = newsTitle || reviewTitle || 'Общий контекст'
                                const type = log.news_id ? 'News' : log.review_id ? 'Review' : 'Other'

                                return (
                                    <div
                                        key={log.id}
                                        className="group flex flex-col p-8 hover:bg-slate-500/[0.02] dark:hover:bg-slate-100/[0.02] transition-colors duration-300 relative"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm",
                                                    type === 'News' ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400" :
                                                        type === 'Review' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                                                            "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                                                )}>
                                                    {type}
                                                </div>
                                                <h4 className="text-base font-black text-foreground/90 line-clamp-1 max-w-[500px] group-hover:text-primary transition-colors tracking-tight">
                                                    {title}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/50">
                                                <Calendar className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
                                                <time className="text-[11px] font-black text-muted-foreground tabular-nums">
                                                    {new Date(log.created_at).toLocaleString('ru-RU', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </time>
                                            </div>
                                        </div>

                                        <div className="relative pl-6 border-l-4 border-purple-500/30 group-hover:border-purple-500/60 transition-all duration-500">
                                            <p className="text-base font-bold text-foreground leading-relaxed mb-4 group-hover:translate-x-1 transition-transform duration-300">
                                                {log.instruction}
                                            </p>

                                            {log.original_text_snippet && (
                                                <div className="flex flex-col gap-2 p-5 rounded-[1.25rem] bg-slate-50/50 dark:bg-slate-900/40 border-2 border-border/40 text-sm shadow-inner group-hover:border-purple-500/20 transition-colors">
                                                    <span className="text-[9px] font-black text-purple-500 uppercase tracking-[0.2em] opacity-80">
                                                        Фрагмент оригинала
                                                    </span>
                                                    <p className="text-muted-foreground italic leading-relaxed line-clamp-3 font-medium">
                                                        «{log.original_text_snippet}»
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
                <div className="mt-6 px-4 py-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 italic">
                        Аудит активен • Последние 50 операций
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Live Logs</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
