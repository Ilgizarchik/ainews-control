'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

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
}

export function NewsEditorDialog({ newsId, isOpen, onClose, onSaved }: NewsEditorDialogProps) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [data, setData] = useState<NewsData>({
        draft_title: '',
        draft_announce: '',
        draft_longread: ''
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
                .select('draft_title, draft_announce, draft_longread')
                .eq('id', newsId)
                .single()

            if (error) throw error
            if (data) {
                const typedData = data as any
                setData({
                    draft_title: typedData.draft_title || '',
                    draft_announce: typedData.draft_announce || '',
                    draft_longread: typedData.draft_longread || ''
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
                    draft_longread: data.draft_longread
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
