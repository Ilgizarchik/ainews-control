'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { Loader2, Check, Trash2, XCircle, History, Tag, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RichEditor } from '@/components/ui/rich-editor'
import { VoiceInput } from '@/components/ui/voice-input'
import { getTagColors, getTagBadgeColors } from '@/lib/tag-colors'
import { PlatformAnnouncesTab } from './PlatformAnnouncesTab'
import { MediaTab } from './MediaTab'
import { isMarkdown, markdownToHtml } from '@/lib/markdown-utils'
import { TutorialButton } from '../tutorial/TutorialButton'
import { getEditorTutorialSteps } from '@/lib/tutorial/tutorial-config'

type NewsEditorDialogProps = {
    contentId: string
    contentType?: 'news' | 'review'
    isOpen: boolean
    onClose: () => void
    onSaved: () => void
}

type NewsData = {
    draft_title: string
    draft_announce: string
    draft_longread: string
    draft_image_prompt?: string
    draft_image_url?: string
    gate1_tags: string[]
}

type CorrectionHistoryItem = {
    date: string
    instruction: string
    original_text_snippet: string
}

const AVAILABLE_TAGS = ["hunting", "weapons", "dogs", "recipes", "culture", "travel", "law", "events", "conservation", "other"]

export function NewsEditorDialog({ contentId, contentType = 'news', isOpen, onClose, onSaved }: NewsEditorDialogProps) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState('')
    const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistoryItem[]>([])
    const [data, setData] = useState<NewsData>({
        draft_title: '',
        draft_announce: '',
        draft_longread: '',
        draft_image_prompt: '',
        draft_image_url: '',
        gate1_tags: []
    })

    const [announces, setAnnounces] = useState<Record<string, string>>({})
    const [activeTab, setActiveTab] = useState('main')

    const editorSteps = useMemo(() => getEditorTutorialSteps(setActiveTab), [])

    const supabase = createClient()

    const fetchContentData = useCallback(async () => {
        setLoading(true)
        try {
            let { data, error } = await supabase
                .from(contentType === 'review' ? 'review_items' : 'news_items')
                .select('*')
                .eq('id', contentId)
                .single()

            if (error || !data) {
                const fallbackTable = contentType === 'review' ? 'news_items' : 'review_items'
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from(fallbackTable)
                    .select('*')
                    .eq('id', contentId)
                    .single()

                if (fallbackError) throw error || fallbackError
                data = fallbackData
            }

            if (data) {
                const typedData = data as any

                if (typedData.correction_history && Array.isArray(typedData.correction_history)) {
                    setCorrectionHistory(typedData.correction_history)
                } else {
                    setCorrectionHistory([])
                }

                let longreadContent = typedData.draft_longread || ''
                if (longreadContent && isMarkdown(longreadContent)) {
                    longreadContent = markdownToHtml(longreadContent)
                }

                let effectiveImageUrl = typedData.draft_image_url || typedData.image_url || ''
                if (typedData.draft_image_file_id) {
                    effectiveImageUrl = `/api/telegram/photo/${typedData.draft_image_file_id}`
                }

                setData({
                    draft_title: typedData.draft_title || typedData.title || typedData.title_seed || '',
                    draft_announce: typedData.draft_announce || '',
                    draft_longread: longreadContent,
                    draft_image_prompt: typedData.draft_image_prompt || '',
                    draft_image_url: effectiveImageUrl,
                    gate1_tags: typedData.gate1_tags || []
                })

                const loadedAnnounces: Record<string, string> = {}
                const PLATFORMS = ['site', 'tg', 'vk', 'ok', 'fb', 'x', 'threads']
                PLATFORMS.forEach(platform => {
                    let key = platform === 'site' ? 'draft_longread_site' : (platform === 'threads' ? 'draft_announce_threads' : `draft_announce_${platform}`)
                    loadedAnnounces[platform] = typedData[key] || ''
                })
                setAnnounces(loadedAnnounces)

            }
        } catch (e: any) {
            toast.error(`Ошибка загрузки: ${e?.message || 'Неизвестная ошибка'}`)
            onClose()
        } finally {
            setLoading(false)
        }
    }, [contentId, contentType, onClose, supabase])

    useEffect(() => {
        if (isOpen && contentId) {
            fetchContentData()
        }
    }, [contentId, fetchContentData, isOpen])

    const handleSave = async () => {
        setSaving(true)
        try {
            const updateData: any = {
                draft_title: data.draft_title,
                draft_announce: data.draft_announce,
                draft_longread: data.draft_longread,
            }

            const PLATFORMS = ['site', 'tg', 'vk', 'ok', 'fb', 'x', 'threads']
            PLATFORMS.forEach(platform => {
                let key = platform === 'site' ? 'draft_longread_site' : (platform === 'threads' ? 'draft_announce_threads' : `draft_announce_${platform}`)
                updateData[key] = announces[platform] || ''
            })

            if (contentType === 'news') updateData.gate1_tags = data.gate1_tags

            const { error } = await supabase
                .from(contentType === 'review' ? 'review_items' : 'news_items')
                .update(updateData)
                .eq('id', contentId)

            if (error) throw error

            const jobsToUpdate = PLATFORMS.map(platform => {
                const newText = announces[platform]
                if (!newText) return null
                return supabase.from('publish_jobs').update({ social_content: newText }).eq(contentType === 'review' ? 'review_id' : 'news_id', contentId).eq('platform', platform).in('status', ['queued', 'cancelled'])
            }).filter(Boolean)

            if (jobsToUpdate.length > 0) await Promise.all(jobsToUpdate)

            toast.success('Изменения сохранены')
            onSaved(); onClose()
        } catch {
            toast.error('Ошибка при сохранении')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        try {
            const { data: jobs } = await supabase.from('publish_jobs').select('platform').eq(contentType === 'review' ? 'review_id' : 'news_id', contentId).neq('status', 'cancelled')
            const platforms = Array.from(new Set(jobs?.map((j: any) => j.platform) || [])).join(', ')
            setDeleteConfirmMsg(`Публикации будут удалены (cancelled) в соц. сетях: ${platforms || '(нет активных)'}.\n\nВы уверены, что хотите отклонить новость?`)
            setDeleteConfirmOpen(true)
        } catch (e: any) { toast.error('Ошибка проверки: ' + e.message) }
    }

    const confirmDelete = async () => {
        try {
            setDeleting(true)
            const { data: { user } } = await supabase.auth.getUser()
            await (supabase.from('publish_jobs').update({ status: 'cancelled' }).eq(contentType === 'review' ? 'review_id' : 'news_id', contentId) as any)
            const updateData: any = { status: 'rejected' }
            if (contentType === 'news') {
                updateData.approve1_decision = 'rejected'
                updateData.approve1_decided_at = new Date().toISOString()
                updateData.approve1_decided_by = user?.id || 'editor'
            }
            const { error } = await supabase.from(contentType === 'review' ? 'review_items' : 'news_items').update(updateData).eq('id', contentId)
            if (error) throw error
            toast.success('Новость отклонена (Rejected)')
            setDeleteConfirmOpen(false); onSaved(); onClose()
        } catch (e: any) { toast.error('Ошибка отклонения: ' + e.message) } finally { setDeleting(false) }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-2 border-border/50 shadow-2xl rounded-3xl">
                    <DialogHeader data-tutorial="editor-header" className="px-8 py-6 border-b-2 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 shrink-0 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            <DialogTitle className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Редактирование контента</DialogTitle>

                            {correctionHistory.length > 0 && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground hover:text-foreground rounded-xl border border-border/50 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all">
                                            <History className="w-4 h-4" />
                                            <span className="text-xs font-bold">История правок ({correctionHistory.length})</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0 rounded-2xl border-2 shadow-xl" align="end">
                                        <div className="flex flex-col max-h-[300px] overflow-y-auto">
                                            <div className="px-4 py-3 border-b-2 bg-muted/30 text-xs font-black uppercase sticky top-0 backdrop-blur-sm">История запросов к AI</div>
                                            {correctionHistory.slice().reverse().map((item, i) => (
                                                <div key={i} className="p-3 border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                    <div className="text-[10px] text-muted-foreground font-mono font-bold mb-1">{new Date(item.date).toLocaleString('ru-RU')}</div>
                                                    <div className="text-sm border-l-2 border-emerald-500 pl-2.5">{item.instruction}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Standard close button is rendered by DialogContent */}
                        </div>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-8 pt-6 shrink-0">
                                <TabsList data-tutorial="editor-tabs" className="grid w-full grid-cols-4 p-1 bg-muted/40 rounded-2xl border-2 border-border/50">
                                    <TabsTrigger value="main" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-bold transition-all">Основное</TabsTrigger>
                                    <TabsTrigger data-tutorial="article-tab" value="longread" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-bold transition-all">Статья</TabsTrigger>
                                    <TabsTrigger data-tutorial="media-tab" value="media" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-bold transition-all">Медиа</TabsTrigger>
                                    <TabsTrigger data-tutorial="platforms-tab" value="social" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-bold transition-all">Площадки</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0 bg-background/50">
                                <TabsContent value="main" className="space-y-8 mt-0 h-full animate-in fade-in slide-in-from-bottom-2">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">📌 Заголовок</Label>
                                            <div className="flex items-center gap-3">
                                                <VoiceInput onTranscription={(t) => setData(p => ({ ...p, draft_title: p.draft_title ? `${p.draft_title} ${t}` : t }))} />
                                            </div>
                                        </div>
                                        <Input data-tutorial="title-input" value={data.draft_title} onChange={(e) => setData(p => ({ ...p, draft_title: e.target.value }))} placeholder="Заголовок..." className="h-14 text-xl font-bold rounded-2xl border-2 px-4" />
                                    </div>

                                    <div className="space-y-4 flex-1 flex flex-col min-h-[300px]">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">📢 Анонс</Label>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-black uppercase px-2 py-1 bg-muted rounded-full border">{data.draft_announce.length} символов</span>
                                                <VoiceInput onTranscription={(t) => setData(p => ({ ...p, draft_announce: p.draft_announce ? `${p.draft_announce} ${t}` : t }))} />
                                            </div>
                                        </div>
                                        <div data-tutorial="announce-input">
                                            <RichEditor value={data.draft_announce} onChange={(v) => setData(p => ({ ...p, draft_announce: v }))} className="min-h-[200px] flex-1 rounded-2xl border-2" itemId={contentId} itemType={contentType as 'news' | 'review'} />
                                        </div>
                                    </div>

                                    {contentType === 'news' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2"><Label className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Tag className="w-4 h-4" /> Теги</Label></div>
                                            <div data-tutorial="tags-section" className="p-6 border-2 border-border/50 rounded-2xl bg-muted/10 flex flex-wrap gap-3">
                                                {data.gate1_tags.map(tag => (
                                                    <div key={tag} className={cn("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border-2", getTagBadgeColors(tag))}>
                                                        <span>{tag}</span>
                                                        <button onClick={() => setData(p => ({ ...p, gate1_tags: p.gate1_tags.filter(t => t !== tag) }))}><XCircle className="w-4 h-4 opacity-60" /></button>
                                                    </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-10 rounded-xl border-dashed border-2 gap-2 font-black uppercase text-xs"><Plus className="w-4 h-4" /> Добавить</Button></PopoverTrigger>
                                                    <PopoverContent className="w-60 p-2 rounded-2xl border-2 shadow-xl"><div className="grid gap-1">{AVAILABLE_TAGS.map(t => { const s = data.gate1_tags.includes(t); const c = getTagColors(t); return <button key={t} onClick={() => setData(p => ({ ...p, gate1_tags: s ? p.gate1_tags.filter(x => x !== t) : [...p.gate1_tags, t] }))} className={cn("w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold uppercase", s ? c.bg : "hover:bg-muted")}><span className={cn("flex items-center gap-2", c.text, !s && "opacity-60")}>{t}</span>{s && <Check className="w-4 h-4" />}</button> })}</div></PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="longread" className="mt-0 h-full animate-in fade-in slide-in-from-bottom-2 flex flex-col space-y-6">
                                    <div className="shrink-0 flex items-center justify-between">
                                        <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">📜 Статья</Label>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black uppercase px-2 py-1 bg-muted rounded-full border">{data.draft_longread?.length || 0} символов</span>
                                            <div className="flex items-center gap-3">
                                                <VoiceInput onTranscription={(t) => setData(p => ({ ...p, draft_longread: p.draft_longread ? `${p.draft_longread} ${t}` : t }))} />
                                            </div>
                                        </div>
                                    </div>
                                    <div data-tutorial="article-content" className="flex-1 bg-background rounded-3xl border-2 overflow-hidden">
                                        <RichEditor value={data.draft_longread} onChange={(v) => setData(p => ({ ...p, draft_longread: v }))} className="h-full border-0" itemId={contentId} itemType={contentType as 'news' | 'review'} />
                                    </div>
                                </TabsContent>

                                <TabsContent value="media" className="mt-0 h-full flex flex-col">
                                    <div data-tutorial="media-content" className="flex-1 flex flex-col">
                                        <MediaTab contentId={contentId} contentType={contentType} initialImageUrl={data.draft_image_url} onUpdated={(u: string, p: string) => setData(prev => ({ ...prev, draft_image_url: u, draft_image_prompt: p }))} tutorialSteps={editorSteps} />
                                    </div>
                                </TabsContent>
                                <TabsContent value="social" className="mt-0 h-full flex flex-col"><PlatformAnnouncesTab contentId={contentId} contentType={contentType} baseAnnounce={data.draft_announce} longread={data.draft_longread} announces={announces} onChange={(pl, v) => setAnnounces(p => ({ ...p, [pl]: v }))} onAnnouncesGenerated={(a) => setAnnounces(p => ({ ...p, ...a }))} tutorialSteps={editorSteps} /></TabsContent>
                            </div>

                            <DialogFooter className="px-8 py-5 border-t-2 bg-muted/10 shrink-0 flex items-center justify-between">
                                <TutorialButton
                                    variant="outline"
                                    label="Помощь"
                                    className="h-10 px-4 gap-2 text-emerald-600 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 rounded-xl transition-all"
                                    steps={editorSteps}
                                />
                                <div className="flex items-center gap-4">
                                    <Button data-tutorial="reject-button" variant="ghost" className="h-11 px-6 text-red-600 rounded-xl font-bold" onClick={handleDelete} disabled={deleting || saving}><Trash2 className="w-5 h-5 mr-2" /> Отклонить</Button>
                                    <div className="w-[1px] h-6 bg-border/50 mx-1" />
                                    <Button variant="outline" onClick={onClose} className="h-11 px-8 rounded-xl border-2 font-bold">Отмена</Button>
                                    <Button data-tutorial="save-button" onClick={handleSave} disabled={saving} className="h-11 px-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-105">Сохранить</Button>
                                </div>
                            </DialogFooter>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="max-w-md rounded-3xl border-2 shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 bg-rose-50 border-b-2 border-rose-100">
                        <DialogTitle className="text-xl font-black text-rose-700">Подтверждение удаления</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 text-sm">{deleteConfirmMsg}</div>
                    <DialogFooter className="p-6 bg-muted/20 border-t-2 gap-3">
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1 h-11 rounded-xl">Отмена</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1 h-11 rounded-xl font-black">{deleting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Да, отклонить'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
