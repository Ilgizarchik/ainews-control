'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { Loader2, Save, Check, Trash2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RichEditor } from '@/components/ui/rich-editor'
import { VoiceInput } from '@/components/ui/voice-input'
import { getTagColors, getTagBadgeColors } from '@/lib/tag-colors'
import { ScheduleTab } from './ScheduleTab'
import { PlatformAnnouncesTab } from './PlatformAnnouncesTab'
import { MediaTab } from './MediaTab'

// Helper: Detect if content is markdown
function isMarkdown(text: string): boolean {
    if (!text) return false
    // Check for common markdown patterns
    const markdownPatterns = [
        /^#{1,6}\s/m,           // Headers
        /\*\*.*\*\*/,            // Bold
        /\*.*\*/,                // Italic
        /^\* /m,                 // Unordered list
        /^\d+\. /m,              // Ordered list
        /\[.*\]\(.*\)/,          // Links
        /^```/m,                 // Code blocks
        /^\> /m                  // Blockquotes
    ]
    return markdownPatterns.some(pattern => pattern.test(text))
}

// Helper: Convert markdown to HTML
function markdownToHtml(markdown: string): string {
    if (!markdown) return ''

    let html = markdown

    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')

    // Unordered lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

    // Inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>')

    // Blockquotes
    html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>')

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>')
    html = `<p>${html}</p>`

    return html
}

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

const AVAILABLE_TAGS = ["hunting", "weapons", "dogs", "recipes", "culture", "travel", "law", "events", "conservation", "other"]

export function NewsEditorDialog({ contentId, contentType = 'news', isOpen, onClose, onSaved }: NewsEditorDialogProps) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState('')
    const [wasMarkdown, setWasMarkdown] = useState(false) // Track if content was converted from markdown
    const [hasJobs, setHasJobs] = useState(false)
    const [data, setData] = useState<NewsData>({
        draft_title: '',
        draft_announce: '',
        draft_longread: '',
        draft_image_prompt: '',
        draft_image_url: '',
        gate1_tags: []
    })

    const [announces, setAnnounces] = useState<Record<string, string>>({})

    const supabase = createClient()

    useEffect(() => {
        if (isOpen && contentId) {
            fetchContentData()
        }
    }, [isOpen, contentId])

    const fetchContentData = async () => {
        setLoading(true)
        try {
            let query = supabase.from(contentType === 'review' ? 'review_items' : 'news_items').select('*').eq('id', contentId).single()

            const { data, error } = await query

            if (error) throw error
            if (data) {
                const typedData = data as any

                // Convert markdown to HTML if needed
                let longreadContent = typedData.draft_longread || ''
                const isMarkdownContent = isMarkdown(longreadContent)

                if (longreadContent && isMarkdownContent) {
                    longreadContent = markdownToHtml(longreadContent)
                    setWasMarkdown(true)
                } else {
                    setWasMarkdown(false)
                }

                // Determine effective image URL
                // If we have a file_id, use our proxy route. Otherwise fall back to public URL.
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

                // Load platform announces
                const loadedAnnounces: Record<string, string> = {}
                const PLATFORMS = ['site', 'tg', 'vk', 'ok', 'fb', 'x', 'threads']

                PLATFORMS.forEach(platform => {
                    // Determine correct column logic (copied from PlatformAnnouncesTab)
                    let key = `draft_announce_${platform}`
                    if (platform === 'site') key = 'draft_longread_site'
                    if (platform === 'threads') key = 'draft_announce_threads'

                    loadedAnnounces[platform] = typedData[key] || ''
                })
                setAnnounces(loadedAnnounces)


                // Check if has jobs
                const { count } = await (supabase
                    .from('publish_jobs')
                    .select('*', { count: 'exact', head: true })
                    .eq(contentType === 'review' ? 'review_id' : 'news_id', contentId)
                    .neq('status', 'cancelled') as any)
            }
        } catch (e) {
            console.error(e)
            toast.error('Не удалось загрузить данные')
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const updateData: any = {
                draft_title: data.draft_title,
                draft_announce: data.draft_announce,
                draft_longread: data.draft_longread,
            }

            // Add platform announces to updateData
            const PLATFORMS = ['site', 'tg', 'vk', 'ok', 'fb', 'x', 'threads']
            PLATFORMS.forEach(platform => {
                let key = `draft_announce_${platform}`
                if (platform === 'site') key = 'draft_longread_site'
                if (platform === 'threads') key = 'draft_announce_threads'
                updateData[key] = announces[platform] || ''
            })

            if (contentType === 'news') {
                updateData.gate1_tags = data.gate1_tags
            }

            const { error } = await supabase
                .from(contentType === 'review' ? 'review_items' : 'news_items')
                .update(updateData)
                .eq('id', contentId)

            if (error) throw error

            // --- NEW: SYNC JOBS ---
            // If the user updated the platform-specific texts, we SHOULD update existing NOT-YET-PUBLISHED jobs 
            // so they don't stay with stale/error content.
            const jobsToUpdate = []
            for (const platform of PLATFORMS) {
                const newText = announces[platform]
                if (newText) {
                    jobsToUpdate.push(
                        supabase
                            .from('publish_jobs')
                            // @ts-ignore
                            .update({ social_content: newText })
                            .eq(contentType === 'review' ? 'review_id' : 'news_id', contentId)
                            .eq('platform', platform)
                            .in('status', ['queued', 'cancelled']) // Update both so we can "uncancel" if needed or just fix old errors
                    )
                }
            }

            if (jobsToUpdate.length > 0) {
                console.log('[NewsEditorDialog] Syncing content to existing jobs...', jobsToUpdate.length)
                await Promise.all(jobsToUpdate)
            }
            // ----------------------

            toast.success('Изменения сохранены')
            onSaved()
            onClose()
        } catch (e) {
            console.error('[NewsEditorDialog] Save error:', e)
            toast.error('Ошибка при сохранении')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        try {
            setDeleting(true)
            // Fetch connected jobs
            const { data: jobs } = await supabase
                .from('publish_jobs')
                .select('platform')
                .eq(contentType === 'review' ? 'review_id' : 'news_id', contentId)
                .neq('status', 'cancelled')

            const platforms = Array.from(new Set(jobs?.map((j: any) => j.platform) || [])).join(', ')

            const msg = `Публикации будут удалены (cancelled) в соц. сетях: ${platforms || '(нет активных)'}.\n\nВы уверены, что хотите отклонить новость?`

            setDeleteConfirmMsg(msg)
            setDeleteConfirmOpen(true)
        } catch (e: any) {
            toast.error('Ошибка проверки: ' + e.message)
            console.error(e)
        } finally {
            setDeleting(false)
        }
    }

    const confirmDelete = async () => {
        try {
            setDeleting(true)

            // Get user for audit
            const { data: { user } } = await supabase.auth.getUser()

            // 1. Cancel jobs
            const { error: jobError } = await ((supabase
                .from('publish_jobs') as any)
                .update({ status: 'cancelled' })
                .eq(contentType === 'review' ? 'review_id' : 'news_id', contentId) as any)

            if (jobError) throw jobError

            // 2. Reject item
            const updateData: any = {
                status: 'rejected'
            }

            // For news items, we must also update Gate 1 decision to avoid it appearing in Pending list
            if (contentType === 'news') {
                updateData.approve1_decision = 'rejected'
                updateData.approve1_decided_at = new Date().toISOString()
                updateData.approve1_decided_by = user?.id || 'editor'
            }

            const { error: itemError } = await ((supabase
                .from(contentType === 'review' ? 'review_items' : 'news_items') as any)
                .update(updateData)
                .eq('id', contentId) as any)

            if (itemError) throw itemError

            toast.success('Новость отклонена (Rejected)')
            setDeleteConfirmOpen(false)
            onSaved() // Refresh list
            onClose()

        } catch (e: any) {
            toast.error('Ошибка отклонения: ' + e.message)
            console.error(e)
            setDeleting(false)
        }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
                        <DialogTitle className="text-xl font-semibold tracking-tight">Редактирование контента</DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Tabs defaultValue="main" className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-6 pt-4 shrink-0">
                                <TabsList className={cn("grid w-full", hasJobs ? "grid-cols-3" : "grid-cols-4")}>
                                    <TabsTrigger value="main">Основное</TabsTrigger>
                                    <TabsTrigger value="longread">Полная статья</TabsTrigger>
                                    <TabsTrigger value="media">Медиа</TabsTrigger>
                                    <TabsTrigger value="social">Площадки</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                                <TabsContent value="main" className="space-y-6 mt-0 h-full">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="title" className="text-base font-medium">Заголовок</Label>
                                            <VoiceInput
                                                onTranscription={(text) => setData(prev => ({ ...prev, draft_title: prev.draft_title ? `${prev.draft_title} ${text}` : text }))}
                                            />
                                        </div>
                                        <Input
                                            id="title"
                                            value={data.draft_title}
                                            onChange={(e) => setData(prev => ({ ...prev, draft_title: e.target.value }))}
                                            placeholder="Введите заголовок..."
                                            className="text-lg font-medium py-6"
                                        />
                                    </div>

                                    <div className="space-y-3 flex-1 flex flex-col">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="announce" className="text-base font-medium">Анонс для соцсетей</Label>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {data.draft_announce.length} символов
                                            </span>
                                        </div>
                                        <RichEditor
                                            value={data.draft_announce}
                                            onChange={(val) => setData(prev => ({ ...prev, draft_announce: val }))}
                                            className="min-h-[200px] flex-1"
                                        />
                                    </div>


                                    {contentType === 'news' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-base font-medium">Теги</Label>
                                                <span className="text-xs text-muted-foreground">
                                                    {data.gate1_tags?.length || 0} выбрано
                                                </span>
                                            </div>
                                            <div className="relative flex flex-wrap gap-2.5 p-4 border-2 border-border/50 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 min-h-[70px] items-start">
                                                {(data.gate1_tags?.length ?? 0) === 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-sm text-muted-foreground/60 italic">Нажмите "+ Добавить тег", чтобы выбрать</span>
                                                    </div>
                                                )}

                                                {(data.gate1_tags || []).map((tag: string) => {
                                                    return (
                                                        <div
                                                            key={tag}
                                                            className={cn(
                                                                "group px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border transition-all duration-200 hover:scale-105 hover:shadow-md",
                                                                getTagBadgeColors(tag)
                                                            )}
                                                        >
                                                            <svg className="w-3 h-3 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="capitalize font-semibold">{tag}</span>
                                                            <button
                                                                onClick={() => setData(prev => ({ ...prev, gate1_tags: prev.gate1_tags.filter((t: string) => t !== tag) }))}
                                                                className="ml-0.5 text-current opacity-60 hover:opacity-100 transition-opacity hover:scale-125 transform"
                                                                title="Удалить тег"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )
                                                })}

                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 px-3 text-xs font-medium border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all duration-200 hover:scale-105"
                                                        >
                                                            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                            Добавить тег
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-60 p-2" align="start">
                                                        <div className="space-y-0.5">
                                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                                                                Выберите теги
                                                            </div>
                                                            {AVAILABLE_TAGS.map(tag => {
                                                                const isSelected = data.gate1_tags.includes(tag)
                                                                const colors = getTagColors(tag)

                                                                return (
                                                                    <button
                                                                        key={tag}
                                                                        onClick={() => {
                                                                            if (isSelected) {
                                                                                setData(prev => ({ ...prev, gate1_tags: prev.gate1_tags.filter((t: string) => t !== tag) }))
                                                                            } else {
                                                                                setData(prev => ({ ...prev, gate1_tags: [...prev.gate1_tags, tag] }))
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                                                                            isSelected
                                                                                ? cn("shadow-sm", colors.bg)
                                                                                : "hover:bg-muted"
                                                                        )}
                                                                    >
                                                                        <span className={cn(
                                                                            "capitalize flex items-center gap-2 font-medium",
                                                                            colors.text,
                                                                            !isSelected && "opacity-60"
                                                                        )}>
                                                                            <svg className={cn("w-3.5 h-3.5", colors.icon, !isSelected && "opacity-50")} fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                                            </svg>
                                                                            {tag}
                                                                        </span>
                                                                        {isSelected && (
                                                                            <Check className={cn("w-4 h-4", colors.icon)} strokeWidth={3} />
                                                                        )}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            <div className="pt-2">
                                                <Button
                                                    variant="ghost"
                                                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-2 border-dashed border-red-200 dark:border-red-900/30 h-10"
                                                    onClick={handleDelete}
                                                    disabled={deleting || saving}
                                                >
                                                    {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                    Отклонить
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="longread" className="mt-0 h-full flex flex-col">
                                    <div className="space-y-3 h-full flex flex-col">
                                        <div className="flex items-center justify-between shrink-0">
                                            <Label htmlFor="longread" className="text-base font-medium">Полный текст статьи</Label>
                                            {wasMarkdown && (
                                                <div className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Markdown → HTML
                                                </div>
                                            )}
                                        </div>
                                        <RichEditor
                                            value={data.draft_longread}
                                            onChange={(val) => setData(prev => ({ ...prev, draft_longread: val }))}
                                            className="flex-1 min-h-0"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="media" className="mt-0 h-full flex flex-col">
                                    <MediaTab
                                        contentId={contentId}
                                        initialImageUrl={data.draft_image_url}
                                        onUpdated={(newUrl, newPrompt) => {
                                            setData(prev => ({
                                                ...prev,
                                                draft_image_url: newUrl,
                                                draft_image_prompt: newPrompt
                                            }))
                                        }}
                                    />
                                </TabsContent>

                                <TabsContent value="social" className="mt-0 h-full flex flex-col">
                                    <PlatformAnnouncesTab
                                        contentId={contentId}
                                        contentType={contentType}
                                        baseAnnounce={data.draft_announce}
                                        longread={data.draft_longread}
                                        announces={announces}
                                        onChange={(platform, value) => setAnnounces(prev => ({ ...prev, [platform]: value }))}
                                        onAnnouncesGenerated={(newAnnounces) => setAnnounces(prev => ({ ...prev, ...newAnnounces }))}
                                    />
                                </TabsContent>

                                <TabsContent value="schedule" className="mt-0 h-full flex flex-col">
                                    <ScheduleTab
                                        contentId={contentId}
                                        contentType={contentType}
                                        onScheduled={() => {
                                            toast.success('Публикация запланирована!')
                                            onSaved()
                                            onClose()
                                        }}
                                    />
                                </TabsContent>
                            </div>

                            <DialogFooter className="px-6 py-4 border-t bg-muted/10 shrink-0">
                                <Button variant="outline" onClick={onClose} className="h-10 px-6">Отмена</Button>
                                <Button onClick={handleSave} disabled={saving} className="h-10 px-6 gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Сохранить
                                </Button>
                            </DialogFooter>
                        </Tabs >
                    )
                    }
                </DialogContent >
            </Dialog >

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Подтверждение удаления</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-sm whitespace-pre-line text-muted-foreground">
                        {deleteConfirmMsg}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Отмена</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Да, отклонить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
