'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { JobWithNews } from '@/hooks/useBoardJobs'
import { format } from 'date-fns'
import { MagicTextEditor } from './magic-text-editor'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2, Calendar as CalendarIcon, Save, Wand2, RefreshCw } from 'lucide-react'
import { cn, convertBbcodeToHtml } from '@/lib/utils'
import { VoiceInput } from '@/components/ui/voice-input'

interface SocialPostEditorDialogProps {
    job: JobWithNews
    isOpen: boolean
    onClose: () => void
    onUpdate: () => void // Callback to refresh board
    onOptimisticCancel?: (jobId: string) => void
    onOptimisticRemove?: (contentId: string) => void
}

export function SocialPostEditorDialog({ job, isOpen, onClose, onUpdate, onOptimisticCancel, onOptimisticRemove }: SocialPostEditorDialogProps) {
    const getDraftContent = () => {
        const item = job.news_items || job.review_items
        if (!item) return ''

        let platformKey = (job.platform || '').toLowerCase()
        if (platformKey === 'twitter') platformKey = 'x'
        if (platformKey === 'telegram') platformKey = 'tg'
        if (platformKey === 'facebook') platformKey = 'fb'

        const field = platformKey === 'site' || platformKey === 'website'
            ? 'draft_longread_site'
            : `draft_announce_${platformKey}`

        return (item as any)[field] || ''
    }

    const [content, setContent] = useState(() => {
        if (job.social_content) return job.social_content
        return getDraftContent()
    })
    const [dateStr, setDateStr] = useState(() => {
        if (!job.publish_at) return ''
        const d = new Date(job.publish_at)
        const offset = d.getTimezoneOffset() * 60000
        return (new Date(d.getTime() - offset)).toISOString().slice(0, 16)
    })
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [hasSelection, setHasSelection] = useState(false)
    const [isMagicOpen, setIsMagicOpen] = useState(false)
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null)
    const [isContentExpanded, setIsContentExpanded] = useState(false)

    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget
        if (target.selectionStart !== target.selectionEnd) {
            setHasSelection(true)
            setSelectionRange({ start: target.selectionStart, end: target.selectionEnd })
        } else {
            setHasSelection(false)
            setSelectionRange(null)
        }
    }

    const handleMagicSave = (newText: string) => {
        if (!selectionRange) return

        const before = content.substring(0, selectionRange.start)
        const after = content.substring(selectionRange.end)
        setContent(before + newText + after)
        setIsMagicOpen(false)
        setHasSelection(false)
    }

    // HTML formatting functions for Telegram
    const wrapSelection = (tag: string, urlPrompt = false) => {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selectedText = content.substring(start, end)

        if (!selectedText) {
            toast.error('Выделите текст для форматирования')
            return
        }

        let wrappedText = ''
        const closeTag = tag.split(' ')[0]

        if (tag === 'a' && urlPrompt) {
            const url = prompt('Введите URL:')
            if (!url) return
            wrappedText = `<a href="${url}">${selectedText}</a>`
        } else {
            wrappedText = `<${tag}>${selectedText}</${closeTag}>`
        }

        const newContent = content.substring(0, start) + wrappedText + content.substring(end)
        setContent(newContent)

        // Restore focus and set cursor position
        setTimeout(() => {
            textarea.focus()
            const newPosition = start + wrappedText.length
            textarea.setSelectionRange(newPosition, newPosition)
        }, 0)
    }


    const handleSave = async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const isNewJob = !job.id || job.id === ''

            // 1. Сначала обновляем сам черновик в исходной таблице (news_items или review_items)
            // Это гарантирует, что при следующем открытии мы увидим обновленный текст
            const contentId = job.review_id || job.news_id
            const table = job.news_id ? 'news_items' : 'review_items'

            if (contentId) {
                let platformKey = (job.platform || '').toLowerCase()
                // Normalize platform keys to match database draft_announce_* columns
                if (platformKey === 'twitter') platformKey = 'x'
                if (platformKey === 'telegram') platformKey = 'tg'
                if (platformKey === 'facebook') platformKey = 'fb'

                const field = platformKey === 'site' || platformKey === 'website'
                    ? 'draft_longread_site'
                    : `draft_announce_${platformKey}`


                const { error: draftUpdateError } = await supabase
                    .from(table)
                    // @ts-ignore
                    .update({ [field]: content })
                    .eq('id', contentId)

                if (draftUpdateError) {
                    console.error('Failed to update source draft:', draftUpdateError)
                    toast.error('Не удалось обновить черновик')
                    // Не прерываем, пробуем обновить job если он есть
                }
            }

            // 2. Если есть job (или мы решили, что save создает job - хотя логичнее отделять save от publish)
            // В текущей логике Save = Create/Update Job. Оставим это, но добавим синхронизацию выше.

            if (isNewJob) {
                // Логика создания job (если нужно). 
                // ВАЖНО: Если мы просто редактируем черновик, возможно нам НЕ НАДО создавать publish_job прямо сейчас?
                // Но существующая логика создавала. Оставим как есть, чтобы не ломать flow публикации.

                const payload: any = {
                    platform: job.platform,
                    status: 'queued',
                    publish_at: new Date(dateStr).toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    social_content: content,
                    retry_count: 0
                }

                if (job.news_id) payload.news_id = job.news_id
                if (job.review_id) payload.review_id = job.review_id

                // Временно комментируем создание авто-джобы при простом сохранении черновика,
                // если это вызывает дублирование или путаницу. 
                // Но судя по коду, DraftsView ожидает просто сохранения контента. 
                // Если мы обновили draft_* поля выше, этого достаточно для DraftsView!

                // Однако, если пользователь ожидает, что это "пойдет в публикацию", то job нужен.
                // Но кнопка называется "Save & Close".

                // Давайте пока обновлять И job тоже, если он был. Если не было - создаем?
                // Если мы просто хотим сохранить текст, создание JOB с статусом QUEUED отправит его в публикацию!
                // Это может быть не то, что хочет пользователь (просто "сохранить").

                // КОМПРОМИСС: Если это создание (isNewJob), мы обновляем только черновик (Draft), 
                // но НЕ создаем Job в статусе queued, если пользователь явно не нажал "Publish".
                // Но здесь кнопка одна "Save".

                // Если мы НЕ создадим job, то `onUpdate` обновит DraftsView, и там будет новый текст (из шага 1).
                // Это решит проблему "текст не сохраняется".

                // Если же нужно именно запланировать, то это отдельная история.
                // Сейчас главное - починить сохранение текста.

                // Оставим создание job, но проверим статус. 
                // Если мы хотим просто сохранить, статус должен быть мб 'draft'? Но Enum не позволяет.

                // РЕШЕНИЕ: Обновляем source table (шаг 1). Это главное.
                // Job создаем/обновляем как и раньше, чтобы не ломать существующие процессы, 
                // НО скорее всего проблема была именно в отсутствии шага 1.

                // НЕ создаем publish_job при сохранении черновика. 
                // Пользователь хочет просто сохранить текст в draft_*.
                // Публикация/создание job-ов происходит через кнопку "Опубликовать" в карточке.

                /*
                const { error } = await supabase.from('publish_jobs').insert(payload)
                if (error) throw error
                */

                toast.success('Черновик обновлен')
            } else {
                // UPDATE existing job
                const updatePayload: any = {
                    social_content: content,
                    publish_at: new Date(dateStr).toISOString(),
                    updated_at: new Date().toISOString()
                }

                // If job was cancelled, reactivate it upon saving
                if (job.status === 'cancelled') {
                    updatePayload.status = 'queued'
                }

                const { error } = await supabase
                    .from('publish_jobs')
                    // @ts-ignore
                    .update(updatePayload)
                    .eq('id', job.id)

                if (error) throw error

                toast.success(job.status === 'cancelled' ? 'Пост восстановлен и обновлен' : 'Пост обновлен')
            }

            onUpdate()
            onClose()
        } catch (e: any) {
            console.error(e)
            toast.error('Ошибка сохранения: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        // Optimistic UI Flow
        const jobId = job.id
        const contentId = job.news_id || job.review_id

        if (onOptimisticCancel && jobId) {
            onOptimisticCancel(jobId)
        } else if (onOptimisticRemove && contentId) {
            onOptimisticRemove(contentId)
        }

        setDeleting(true)
        onClose() // Close immediately

        let isCancelled = false

        // Delay timer
        const timerId = setTimeout(async () => {
            if (isCancelled) return


            try {
                const supabase = createClient()
                const isNewJob = !job.id || job.id === ''

                if (!isNewJob) {
                    // Cancel existing job
                    const { error } = await supabase
                        .from('publish_jobs')
                        // @ts-ignore
                        .update({ status: 'cancelled' })
                        .eq('id', job.id)

                    if (error) {
                        toast.error('Ошибка отмены: ' + error.message)
                        return
                    }
                    onUpdate() // Refresh board
                } else {
                    // Clear draft field (same as before)
                    const contentId = job.review_id || job.news_id
                    const table = job.news_id ? 'news_items' : 'review_items'

                    if (contentId) {
                        let platformKey = (job.platform || '').toLowerCase()
                        if (platformKey === 'twitter') platformKey = 'x'
                        if (platformKey === 'telegram') platformKey = 'tg'
                        if (platformKey === 'facebook') platformKey = 'fb'

                        const field = platformKey === 'site' || platformKey === 'website'
                            ? 'draft_longread_site'
                            : `draft_announce_${platformKey}`

                        await supabase
                            .from(table)
                            // @ts-ignore
                            .update({ [field]: '' })
                            .eq('id', contentId)

                        onUpdate() // Refresh board
                    }
                }
            } catch (e: any) {
                console.error('[handleDelete] Exception:', e)
                toast.error('Ошибка удаления: ' + (e.message || 'Неизвестная ошибка'))
            }
        }, 7000)

        // Show Toast
        toast("Публикация удалена", {
            description: "Действие будет применено через 7 секунд",
            action: {
                label: "Отменить",
                onClick: () => {
                    isCancelled = true
                    clearTimeout(timerId)
                    setDeleting(false)
                    // We can't easily re-open the dialog without props, but since we just closed it, 
                    // user is back on the board. 
                    // Maybe just say "Restored"
                    toast.success('Действие отменено')
                    // NOTE: We rely on the fact that we haven't actually touched the DB yet. 
                    // The UI didn't update (except dialog closed), so nothing to revert visually on the board 
                    // unless the board refreshed? 
                    // We didn't call onUpdate() yet in the optimistic path, so Board is stale (still shows job).
                    // This is perfect!
                }
            },
            duration: 7000,
        })
    }

    // --- MOCKUP RENDERERS ---

    const renderTelegramMockup = () => (
        <div className="w-[480px] h-fit bg-[#0e1621] rounded-[24px] overflow-hidden flex flex-col shadow-2xl border border-gray-800 mockup-animation mb-8">
            {/* Header */}
            <div className="h-12 bg-[#17212b] flex items-center px-4 gap-3 shrink-0">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                    AN
                </div>
                <div className="flex flex-col">
                    <span className="text-white font-medium text-sm">AiNews Channel</span>
                    <span className="text-gray-500 text-xs">bot subscribers</span>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#0e1621] p-3 overflow-y-auto bg-[url('https://w.wallhaven.cc/full/tg/wallhaven-tg5mgl.jpg')] bg-cover relative custom-scrollbar">
                <div className="absolute inset-0 bg-[#0e1621]/80 backdrop-grayscale-[0.5]" /> {/* BG Dimmer */}

                <div className="relative z-10 flex flex-col gap-2">
                    {/* Message Bubble */}
                    <div className="bg-[#182533] rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-sm p-3 max-w-[90%] self-start shadow-sm border border-black/10">
                        {/* Content Display */}
                        <div className="text-white text-[15px] leading-relaxed break-words tg-message-content">
                            <style>{`
                                .tg-message-content b, .tg-message-content strong { font-weight: 700; }
                                .tg-message-content i, .tg-message-content em { font-style: italic; }
                                .tg-message-content u, .tg-message-content ins { text-decoration: underline; }
                                .tg-message-content s, .tg-message-content strike, .tg-message-content del { text-decoration: line-through; }
                                .tg-message-content code { font-family: monospace; color: #64b5ef; background: rgba(84, 169, 235, 0.1); padding: 1px 4px; border-radius: 4px; }
                                .tg-message-content pre { font-family: monospace; display: block; background: rgba(20, 30, 45, 0.8); padding: 8px; border-radius: 8px; margin: 4px 0; overflow-x: auto; border: 1px solid rgba(255,255,255,0.1); }
                                .tg-message-content a { color: #64b5ef; text-decoration: none; word-break: break-all; }
                                .tg-message-content a:hover { text-decoration: underline; }
                                .tg-message-content blockquote { border-left: 3px solid #64b5ef; background: rgba(33, 45, 59, 0.5); border-radius: 0 4px 4px 0; margin: 6px 0; padding: 6px 10px; position: relative; }
                                .tg-message-content blockquote[expandable] { padding-right: 24px; cursor: pointer; }
                                .tg-message-content blockquote[expandable]::after { content: '⌄'; position: absolute; top: 0; right: 6px; font-size: 20px; color: #64b5ef; opacity: 0.7; }
                                .tg-spoiler { background: #3d4c5d; color: transparent; background-image: radial-gradient(circle, #5b6a7d 10%, transparent 10%); background-size: 8px 8px; border-radius: 3px; cursor: pointer; user-select: none; transition: 0.2s; }
                                .tg-spoiler:hover { background-color: #4a5a6b; }
                                .tg-spoiler.revealed { background: transparent; color: inherit; animation: none; cursor: text; background-image: none; }
                                
                                /* Custom Scrollbar Styles */
                                .custom-scrollbar::-webkit-scrollbar {
                                    width: 6px;
                                    height: 6px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-track {
                                    background: transparent;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb {
                                    background: rgba(128, 128, 128, 0.2);
                                    border-radius: 10px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                    background: rgba(128, 128, 128, 0.4);
                                }
                                
                                .mockup-animation {
                                    animation: mockup-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                                }
                                
                                @keyframes mockup-in {
                                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                                    to { opacity: 1; transform: translateY(0) scale(1); }
                                }
                             `}</style>
                            {content ? (
                                <div dangerouslySetInnerHTML={{
                                    __html: convertBbcodeToHtml(content)
                                        .replace(/\n/g, '<br/>')
                                        .replace(/<tg-spoiler>(.*?)<\/tg-spoiler>/g, '<span class="tg-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>')
                                }} />
                            ) : (
                                <span className="text-gray-500 italic">Введите текст публикации...</span>
                            )}
                        </div>
                        <div className="flex justify-end mt-1">
                            <span className="text-[#6c7883] text-[10px]">{format(new Date(dateStr || Date.now()), 'HH:mm')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderDefaultMockup = () => (
        <div className="w-full max-w-lg bg-card border rounded-xl shadow-sm p-4 h-full flex flex-col">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Editor Preview</h3>
            <div className="flex-1 overflow-y-auto border rounded-md p-3">
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words min-h-[200px]">
                    {content || <span className="text-gray-500 italic">Введите текст публикации...</span>}
                </div>
            </div>
        </div>
    )

    const renderThreadsMockup = () => (
        <div className="w-[480px] bg-white dark:bg-black rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8">
            {/* Header */}
            <div className="h-14 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
                <h1 className="text-xl font-bold text-black dark:text-white">Threads</h1>
                <div className="flex items-center gap-2">
                    <button className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Post */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                {/* Profile Row */}
                <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold shrink-0">
                        AI
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-black dark:text-white text-sm">AiNews</span>
                            <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>

                        {/* Content Display */}
                        <div className="text-black dark:text-white text-[15px] leading-relaxed whitespace-pre-wrap break-words min-h-[120px]">
                            {content || <span className="text-gray-500 dark:text-gray-600 italic">Введите текст публикации...</span>}
                        </div>

                        {/* Timestamp */}
                        <div className="text-gray-500 text-sm mt-2">
                            {format(new Date(dateStr || Date.now()), 'HH:mm')}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-4 mt-3 text-gray-600 dark:text-gray-400">
                            <button className="hover:text-red-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </button>
                            <button className="hover:text-blue-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </button>
                            <button className="hover:text-emerald-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <button className="hover:text-purple-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Nav */}
            <div className="h-16 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-4">
                <button className="flex flex-col items-center text-gray-700 dark:text-gray-300">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                </button>
                <button className="flex flex-col items-center text-gray-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
                <button className="flex flex-col items-center text-gray-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                <button className="flex flex-col items-center text-gray-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </button>
                <button className="flex flex-col items-center text-gray-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </button>
            </div>
        </div>
    )

    const renderVKMockup = () => (
        <div className="w-[500px] bg-white dark:bg-[#19191a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8">
            {/* VK Header */}
            <div className="h-14 bg-[#447bba] flex items-center px-4">
                <h1 className="text-white text-xl font-semibold">AiNews</h1>
            </div>

            {/* Post */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shrink-0">
                        AI
                    </div>
                    <div className="flex-1">
                        <div className="font-semibold text-[#2a5885] dark:text-blue-400 mb-1">AiNews</div>
                        <div className="text-sm text-gray-500 mb-3">{format(new Date(dateStr || Date.now()), 'dd MMM в HH:mm')}</div>

                        <div className="text-black dark:text-white text-[15px] leading-relaxed whitespace-pre-wrap break-words min-h-[120px]">
                            {content || <span className="text-gray-500 dark:text-gray-600 italic">Введите текст публикации...</span>}
                        </div>
                    </div>
                </div>

                {/* VK Actions */}
                <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-gray-500 text-sm">
                    <button className="flex items-center gap-1 hover:text-[#447bba]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span>Нравится</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-[#447bba]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Комментировать</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-[#447bba]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span>Поделиться</span>
                    </button>
                </div>
            </div>
        </div>
    )

    const renderOKMockup = () => (
        <div className="w-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            {/* OK Header */}
            <div className="h-14 bg-[#ee8208] flex items-center px-4">
                <h1 className="text-white text-xl font-semibold">Одноклассники</h1>
            </div>

            {/* Post */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold shrink-0">
                        AI
                    </div>
                    <div className="flex-1">
                        <div className="font-semibold text-[#ee8208] mb-1">AiNews</div>
                        <div className="text-sm text-gray-500 mb-3">{format(new Date(dateStr || Date.now()), 'dd MMMM, HH:mm')}</div>

                        <div className="text-black dark:text-white text-[15px] leading-relaxed whitespace-pre-wrap break-words min-h-[120px]">
                            {content || <span className="text-gray-500 dark:text-gray-600 italic">Введите текст публикации...</span>}
                        </div>
                    </div>
                </div>

                {/* OK Actions */}
                <div className="flex items-center justify-around mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ee8208]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        <span className="text-xs">Класс!</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ee8208]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-xs">Обсудить</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ee8208]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span className="text-xs">Поделиться</span>
                    </button>
                </div>
            </div>
        </div>
    )

    const renderFBMockup = () => (
        <div className="w-[500px] bg-white dark:bg-[#18191a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            {/* FB Header */}
            <div className="h-14 bg-[#1877f2] flex items-center px-4">
                <h1 className="text-white text-2xl font-bold">f</h1>
            </div>

            {/* Post */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shrink-0">
                        AI
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-black dark:text-white">AiNews</span>
                            <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-xs text-gray-500 mb-3">{format(new Date(dateStr || Date.now()), 'dd MMM в HH:mm')}</div>

                        <div className="text-black dark:text-[#e4e6eb] text-[15px] leading-relaxed whitespace-pre-wrap break-words min-h-[120px]">
                            {content || <span className="text-gray-500 dark:text-gray-600 italic">Введите текст публикации...</span>}
                        </div>
                    </div>
                </div>

                {/* FB Reactions */}
                <div className="flex items-center justify-around mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        <span className="text-sm font-semibold">Нравится</span>
                    </button>
                    <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-sm font-semibold">Комментировать</span>
                    </button>
                    <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span className="text-sm font-semibold">Поделиться</span>
                    </button>
                </div>
            </div>
        </div>
    )

    const renderXMockup = () => (
        <div className="w-[500px] bg-white dark:bg-black rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8">
            {/* X Header */}
            <div className="h-14 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 flex items-center px-4">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                </svg>
            </div>

            {/* Tweet */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold shrink-0">
                        AI
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-black dark:text-white">AiNews</span>
                            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-500 text-sm">@ainews</span>
                        </div>

                        <div className="text-black dark:text-white text-[15px] leading-relaxed mb-3 whitespace-pre-wrap break-words min-h-[120px]">
                            {content || <span className="text-gray-500 dark:text-gray-600 italic">Введите текст публикации...</span>}
                        </div>

                        <div className="text-gray-500 text-sm mb-3">{format(new Date(dateStr || Date.now()), 'HH:mm · dd MMM yyyy')}</div>

                        {/* X Actions */}
                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-800">
                            <button className="group flex items-center gap-2 hover:text-blue-500">
                                <div className="p-2 rounded-full group-hover:bg-blue-500/10">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                            </button>
                            <button className="group flex items-center gap-2 hover:text-green-500">
                                <div className="p-2 rounded-full group-hover:bg-green-500/10">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                            </button>
                            <button className="group flex items-center gap-2 hover:text-pink-500">
                                <div className="p-2 rounded-full group-hover:bg-pink-500/10">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                </div>
                            </button>
                            <button className="group flex items-center gap-2 hover:text-blue-500">
                                <div className="p-2 rounded-full group-hover:bg-blue-500/10">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderSiteMockup = () => (
        <div className="w-[640px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            {/* Site Header */}
            <div className="h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center px-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <h1 className="text-white text-xl font-bold">AiNews Blog</h1>
                </div>
            </div>

            {/* Article Preview */}
            <div className="p-6">
                <div className="mb-4">
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
                        {format(new Date(dateStr || Date.now()), 'dd MMMM yyyy, HH:mm')}
                    </div>
                </div>

                <div className="text-black dark:text-white text-base leading-relaxed whitespace-pre-wrap break-words min-h-[200px] site-content">
                    <style>{`
                        .site-content h2 { font-size: 1.5em; font-weight: 700; margin-top: 1em; margin-bottom: 0.5em; line-height: 1.2; }
                        .site-content h3 { font-size: 1.25em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; line-height: 1.2; }
                        .site-content blockquote { border-left: 4px solid #10b981; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #4b5563; }
                        .dark .site-content blockquote { color: #9ca3af; }
                        .site-content a { color: #10b981; text-decoration: underline; }
                        .site-content code { background: rgba(0,0,0,0.1); padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
                        .dark .site-content code { background: rgba(255,255,255,0.1); }
                        .site-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 1rem 0; }
                        .site-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 1rem 0; }
                        .site-content b, .site-content strong { font-weight: 700; }
                        .site-content i, .site-content em { font-style: italic; }
                    `}</style>
                    {content ? (
                        <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />
                    ) : (
                        <span className="text-gray-500 dark:text-gray-600 italic">Введите текст публикации...</span>
                    )}
                </div>

                {/* Article Meta */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-sm">1.2k просмотров</span>
                        </button>
                        <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span className="text-sm">24 комментария</span>
                        </button>
                    </div>
                    <button className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-sm font-medium">
                        Читать далее
                    </button>
                </div>
            </div>
        </div>
    )

    const renderPreview = () => {
        switch ((job.platform || '').toLowerCase()) {
            case 'telegram':
            case 'tg':
                return renderTelegramMockup()
            case 'threads':
                return renderThreadsMockup()
            case 'vk':
                return renderVKMockup()
            case 'ok':
                return renderOKMockup()
            case 'facebook':
            case 'fb':
                return renderFBMockup()
            case 'x':
            case 'twitter':
                return renderXMockup()
            case 'site':
            case 'website':
                return renderSiteMockup()
            default:
                return renderDefaultMockup()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0 overflow-hidden flex z-[100]">

                {/* LEFT SIDEBAR: Controls */}
                <div className="w-[450px] bg-card border-r flex flex-col shrink-0 h-full overflow-y-auto custom-scrollbar">
                    {/* Gradient Header */}
                    <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 pb-8">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />

                        <DialogHeader className="relative">
                            <DialogTitle className="text-2xl text-white font-bold flex items-center gap-2">
                                {!job.id || job.id === '' ? '✨ Новая публикация' : '✏️ Редактирование'}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Редактор текста публикации для выбранной социальной сети с предпросмотром и инструментами AI.
                            </DialogDescription>

                            {/* Platform Badge */}
                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full w-fit shadow-lg">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                <span className="text-white font-semibold text-sm uppercase tracking-wide">
                                    {job.platform}
                                </span>
                            </div>
                        </DialogHeader>
                    </div>

                    {/* Content Section */}
                    <div className="p-5 space-y-6 flex-1">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-emerald-500" />
                                    Publishing Time
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-background border-2 border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                    value={dateStr}
                                    onChange={e => setDateStr(e.target.value)}
                                />
                            </div>

                            {/* Content Input */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Content
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-emerald-500"
                                        onClick={() => {
                                            const draftContent = getDraftContent()
                                            if (draftContent) {
                                                setContent(draftContent)
                                                toast.success('Контент обновлен из черновика')
                                            } else {
                                                toast.error('В черновике пусто для этой платформы')
                                            }
                                        }}
                                        title="Обновить из черновика"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                    </Button>
                                </div>
                                {!['telegram', 'tg', 'site', 'website'].includes((job.platform || '').toLowerCase()) && (
                                    <VoiceInput
                                        onTranscription={(text: string) => setContent((prev: string) => prev ? `${prev}\n${text}` : text)}
                                    />
                                )}

                                {/* Formatting Toolbar */}
                                {['telegram', 'tg', 'site', 'website'].includes((job.platform || '').toLowerCase()) && (
                                    <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded-t-lg border border-b-0 border-input">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('b')}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 font-bold"
                                            title="Bold (<b>)"
                                        >
                                            B
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('i')}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 italic"
                                            title="Italic (<i>)"
                                        >
                                            I
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('u')}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 underline"
                                            title="Underline (<u>)"
                                        >
                                            U
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('s')}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 line-through"
                                            title="Strikethrough (<s>)"
                                        >
                                            S
                                        </Button>
                                        {['site', 'website'].includes((job.platform || '').toLowerCase()) && (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => wrapSelection('h2')}
                                                    className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 font-bold text-xs"
                                                    title="Heading 2 (<h2>)"
                                                >
                                                    H2
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => wrapSelection('h3')}
                                                    className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 font-bold text-[10px]"
                                                    title="Heading 3 (<h3>)"
                                                >
                                                    H3
                                                </Button>
                                            </>
                                        )}
                                        <div className="w-px h-6 bg-border mx-1 my-auto" />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('code')}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 font-mono text-xs"
                                            title="Monospace (<code>)"
                                        >
                                            {'<>'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('pre')}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 font-mono text-[10px]"
                                            title="Code Block (<pre>)"
                                        >
                                            {'{ }'}
                                        </Button>
                                        <div className="w-px h-6 bg-border mx-1 my-auto" />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('a', true)}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700"
                                            title="Ссылка (<a>)"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => wrapSelection('blockquote')}
                                            className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700"
                                            title="Цитата (<blockquote>)"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
                                            </svg>
                                        </Button>
                                        {['telegram', 'tg'].includes((job.platform || '').toLowerCase()) && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => wrapSelection('blockquote expandable')}
                                                className="h-7 w-7 p-0 hover:bg-emerald-100 hover:text-emerald-700 relative"
                                                title="Раскрывающаяся цитата (<blockquote expandable>)"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
                                                </svg>
                                                <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold text-emerald-600 bg-white rounded-full px-0.5 leading-none border border-emerald-600">+</span>
                                            </Button>
                                        )}
                                        {['telegram', 'tg'].includes((job.platform || '').toLowerCase()) && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => wrapSelection('tg-spoiler')}
                                                className="h-7 w-auto px-2 hover:bg-emerald-100 hover:text-emerald-700 text-[10px]"
                                                title="Spoiler (<tg-spoiler>)"
                                            >
                                                Спойлер
                                            </Button>
                                        )}

                                        <div className="flex-1" />
                                        <VoiceInput
                                            onTranscription={(text: string) => setContent((prev: string) => prev ? `${prev}\n${text}` : text)}
                                            className="h-7 w-7"
                                        />
                                    </div>
                                )}
                                <div className="relative group">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {!isContentExpanded && (
                                                <span className="text-xs text-muted-foreground">
                                                    {content.length} символов
                                                </span>
                                            )}
                                        </div>
                                        {isContentExpanded && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsContentExpanded(false)}
                                                className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                Свернуть ↑
                                            </Button>
                                        )}
                                    </div>
                                    <textarea
                                        onSelect={handleSelect}
                                        onClick={() => !isContentExpanded && setIsContentExpanded(true)}
                                        className={cn(
                                            "w-full bg-background border-2 border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-sans text-base leading-relaxed custom-scrollbar",
                                            ['telegram', 'tg', 'site', 'website'].includes((job.platform || '').toLowerCase()) && "rounded-t-none border-t-0",
                                            isContentExpanded ? "min-h-[400px]" : "min-h-[72px] max-h-[72px] cursor-pointer hover:border-emerald-400 overflow-hidden",
                                            "transition-all duration-300 ease-in-out"
                                        )}
                                        placeholder={isContentExpanded ? "Введите текст публикации... (поддерживается HTML)" : "Нажмите для редактирования текста..."}
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                    />

                                    {/* Expand Hint with Gradient Overlay */}
                                    {!isContentExpanded && content && (
                                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none flex items-end justify-center pb-2">
                                            <div className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                                Нажмите для раскрытия
                                            </div>
                                        </div>
                                    )}

                                    {/* Floating Magic Edit Button */}
                                    {hasSelection && isContentExpanded && (
                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-2 fade-in zoom-in duration-200">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsMagicOpen(true)}
                                                className="bg-white dark:bg-gray-900 shadow-xl border-purple-100 dark:border-purple-900 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-300 rounded-full h-9 px-5 gap-2 transition-all transform hover:scale-105"
                                            >
                                                <Wand2 className="w-4 h-4" />
                                                <span className="text-xs font-bold">AI Редактор</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Character Counter */}
                            {(() => {
                                const PLATFORM_LIMITS: Record<string, number> = {
                                    telegram: 4096, tg: 4096,
                                    vk: 15000, vkontakte: 15000,
                                    ok: 4096, odnoklassniki: 4096,
                                    facebook: 63000, fb: 63000,
                                    instagram: 2200, ig: 2200,
                                    threads: 500,
                                    twitter: 280, x: 280,
                                    site: 50000, website: 50000
                                }
                                const platformKey = (job.platform || '').toLowerCase()
                                const maxChars = PLATFORM_LIMITS[platformKey] || 2000
                                const isOverLimit = content.length > maxChars
                                const percentage = Math.min((content.length / maxChars) * 100, 100)

                                return (
                                    <div className={cn(
                                        "p-4 rounded-lg border transition-colors duration-300",
                                        isOverLimit
                                            ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                                            : "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                                    )}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={cn(
                                                "text-xs font-semibold",
                                                isOverLimit ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                                            )}>
                                                Символов
                                            </span>
                                            <span className={cn(
                                                "text-lg font-bold",
                                                isOverLimit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                                            )}>
                                                {content.length} <span className="text-xs font-normal opacity-70">/ {maxChars}</span>
                                            </span>
                                        </div>
                                        <div className={cn(
                                            "w-full h-2 rounded-full overflow-hidden",
                                            isOverLimit ? "bg-red-200 dark:bg-red-900/30" : "bg-emerald-200 dark:bg-emerald-900/30"
                                        )}>
                                            <div
                                                className={cn(
                                                    "h-full transition-all duration-300",
                                                    isOverLimit ? "bg-red-500" : "bg-gradient-to-r from-emerald-500 to-emerald-600"
                                                )}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <p className={cn(
                                            "text-xs mt-1",
                                            isOverLimit ? "text-red-600 dark:text-red-500 font-medium" : "text-emerald-600 dark:text-emerald-500"
                                        )}>
                                            {isOverLimit ? 'Превышен лимит символов!' : `Лимит: ${maxChars} символов`}
                                        </p>
                                    </div>
                                )
                            })()}

                            {job.id && job.id !== '' && (
                                <div className="p-4 bg-muted/50 rounded-lg border text-xs text-muted-foreground space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span>Статус:</span>
                                        <span className="font-semibold text-foreground capitalize px-2 py-0.5 bg-background rounded-md">
                                            {job.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>ID:</span>
                                        <span className="font-mono text-foreground">
                                            {job.id.slice(0, 12)}...
                                        </span>
                                    </div>
                                    {job.published_url && (
                                        <div className="flex items-center justify-between pt-1 border-t border-muted/30">
                                            <span>Link:</span>
                                            <a
                                                href={job.published_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                            >
                                                Перейти <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="p-5 border-t bg-muted/30 space-y-3">
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full gap-2 h-11 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Сохранение...' : 'Save & Close'}
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="border-2 hover:bg-muted"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="ghost"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-2 border-transparent hover:border-red-200 dark:hover:border-red-900"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                {deleting ? 'Удаление...' : 'Удалить'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* RIGHT AREA: Preview (Gray Background like a canvas) */}
                <div className="flex-1 bg-gray-50/50 dark:bg-[#09090b] flex justify-center p-8 overflow-y-auto relative custom-scrollbar">
                    <div className="h-fit w-full flex justify-center">
                        <div className="transition-all duration-300 transform-gpu">
                            {renderPreview()}
                        </div>
                    </div>
                </div>


                {/* AI Magic Editor */}
                <MagicTextEditor
                    isOpen={isMagicOpen}
                    onOpenChange={setIsMagicOpen}
                    originalText={selectionRange ? content.substring(selectionRange.start, selectionRange.end) : ''}
                    onSave={handleMagicSave}
                    itemId={job.review_id || job.news_id || undefined}
                    itemType={job.news_id ? 'news' : 'review'}
                />

            </DialogContent>
        </Dialog >
    )
}
