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
import { Loader2, Save, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type NewsEditorDialogProps = {
    newsId: string
    isOpen: boolean
    onClose: () => void
    onSaved: () => void
}

type NewsData = {
    draft_title: string
    draft_announce: string
    draft_longread: string
    gate1_tags: string[]
}

const AVAILABLE_TAGS = ["hunting", "weapons", "dogs", "recipes", "culture", "travel", "law", "events", "conservation", "other"]

export function NewsEditorDialog({ newsId, isOpen, onClose, onSaved }: NewsEditorDialogProps) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [data, setData] = useState<NewsData>({
        draft_title: '',
        draft_announce: '',
        draft_longread: '',
        gate1_tags: []
    })

    const supabase = createClient()

    useEffect(() => {
        if (isOpen && newsId) {
            fetchNewsData()
        }
    }, [isOpen, newsId])

    const fetchNewsData = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('news_items')
                .select('draft_title, draft_announce, draft_longread, gate1_tags')
                .eq('id', newsId)
                .single()

            if (error) throw error
            if (data) {
                const typedData = data as any
                setData({
                    draft_title: typedData.draft_title || '',
                    draft_announce: typedData.draft_announce || '',
                    draft_longread: typedData.draft_longread || '',
                    gate1_tags: typedData.gate1_tags || []
                })
            }
        } catch (e) {
            toast.error('Failed to load news data')
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await (supabase
                .from('news_items')
                .update({
                    draft_title: data.draft_title,
                    draft_announce: data.draft_announce,
                    draft_longread: data.draft_longread,
                    gate1_tags: data.gate1_tags
                } as any)
                .eq('id', newsId) as any)

            if (error) throw error

            toast.success('Changes saved successfully')
            onSaved()
            onClose()
        } catch (e) {
            toast.error('Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
                    <DialogTitle className="text-xl font-semibold tracking-tight">Edit Content</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Tabs defaultValue="main" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 pt-4 shrink-0">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="main">Main Info</TabsTrigger>
                                <TabsTrigger value="longread">Full Article</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                            <TabsContent value="main" className="space-y-6 mt-0 h-full">
                                <div className="space-y-3">
                                    <Label htmlFor="title" className="text-base font-medium">Draft Title</Label>
                                    <Input
                                        id="title"
                                        value={data.draft_title}
                                        onChange={(e) => setData(prev => ({ ...prev, draft_title: e.target.value }))}
                                        placeholder="Enter post title..."
                                        className="text-lg font-medium py-6"
                                    />
                                </div>

                                <div className="space-y-3 flex-1 flex flex-col">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="announce" className="text-base font-medium">Social Media Announce</Label>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {data.draft_announce.length} chars
                                        </span>
                                    </div>
                                    <Textarea
                                        id="announce"
                                        value={data.draft_announce}
                                        onChange={(e) => setData(prev => ({ ...prev, draft_announce: e.target.value }))}
                                        placeholder="Short text for Telegram/VK..."
                                        className="min-h-[300px] font-mono text-sm leading-relaxed resize-y"
                                    />
                                </div>

                                {/* TAGS SECTION */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-base font-medium">Tags</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {data.gate1_tags?.length || 0} selected
                                        </span>
                                    </div>
                                    <div className="relative flex flex-wrap gap-2.5 p-4 border-2 border-border/50 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 min-h-[70px] items-start">
                                        {(data.gate1_tags?.length ?? 0) === 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-sm text-muted-foreground/60 italic">Click "+ Add Tag" to add tags</span>
                                            </div>
                                        )}

                                        {(data.gate1_tags || []).map((tag: string) => {
                                            const tagColors: Record<string, string> = {
                                                hunting: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
                                                weapons: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/25",
                                                dogs: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
                                                recipes: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/25",
                                                culture: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/25",
                                                travel: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/25",
                                                law: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 hover:bg-slate-500/25",
                                                events: "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30 hover:bg-pink-500/25",
                                                conservation: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/25",
                                                other: "bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30 hover:bg-gray-500/25"
                                            }

                                            return (
                                                <div
                                                    key={tag}
                                                    className={cn(
                                                        "group px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border transition-all duration-200 hover:scale-105 hover:shadow-md",
                                                        tagColors[tag] || tagColors.other
                                                    )}
                                                >
                                                    <svg className="w-3 h-3 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="capitalize font-semibold">{tag}</span>
                                                    <button
                                                        onClick={() => setData(prev => ({ ...prev, gate1_tags: prev.gate1_tags.filter((t: string) => t !== tag) }))}
                                                        className="ml-0.5 text-current opacity-60 hover:opacity-100 transition-opacity hover:scale-125 transform"
                                                        title="Remove tag"
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
                                                    Add Tag
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-60 p-2" align="start">
                                                <div className="space-y-0.5">
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                                                        Select tags
                                                    </div>
                                                    {AVAILABLE_TAGS.map(tag => {
                                                        const isSelected = data.gate1_tags.includes(tag)
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
                                                                        ? "bg-primary/10 text-primary font-medium shadow-sm"
                                                                        : "hover:bg-muted text-foreground"
                                                                )}
                                                            >
                                                                <span className="capitalize flex items-center gap-2">
                                                                    <svg className="w-3.5 h-3.5 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                                    </svg>
                                                                    {tag}
                                                                </span>
                                                                {isSelected && (
                                                                    <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                                                                )}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="longread" className="mt-0 h-full flex flex-col">
                                <div className="space-y-3 h-full flex flex-col">
                                    <Label htmlFor="longread" className="text-base font-medium shrink-0">Full Article Content</Label>
                                    <Textarea
                                        id="longread"
                                        value={data.draft_longread}
                                        onChange={(e) => setData(prev => ({ ...prev, draft_longread: e.target.value }))}
                                        placeholder="Full article text (Markdown supported)..."
                                        className="flex-1 font-mono text-sm leading-relaxed resize-none p-4"
                                    />
                                </div>
                            </TabsContent>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t bg-muted/10 shrink-0">
                            <Button variant="outline" onClick={onClose} className="h-10 px-6">Cancel</Button>
                            <Button onClick={handleSave} disabled={saving} className="h-10 px-6 gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}
