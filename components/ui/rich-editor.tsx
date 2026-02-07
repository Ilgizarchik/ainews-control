import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Button } from '@/components/ui/button'
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Quote,
    Heading2,
    Code,
    Undo,
    Redo,
    Strikethrough,
    Wand2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MagicTextEditor } from '@/components/publications/magic-text-editor'
import { VoiceInput } from '@/components/ui/voice-input'

// ... (existing imports)

// ... (hashtags code remains same, skipping for brevity in replacement if not touched, but since I am replacing the function I need to be careful. I will use a targeted replacement for the component function if possible, but imports need to be added. I will replace the imports and the RichEditor component.)
// Actually, I can use replace_content for imports and then another for the component.
// But to be safe and clean, let's just replace the imports block and then the component block. 
// Or better: Replace imports, then replace RichEditor.

// Let's do imports first.
// Wait, I can do it in one go if I replace the whole file? No, too big. 
// I will just add BubbleMenu to imports and MagicTextEditor import.
// Then replace RichEditor function.

// STEP 1: Update imports
// STEP 2: Update RichEditor

// Let's try to match imports block.


type RichEditorProps = {
    value: string
    onChange: (value: string) => void
    className?: string
    itemId?: string
    itemType?: 'news' | 'review'
}

const HashtagHighlighter = Extension.create({
    name: 'hashtagHighlighter',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                state: {
                    init(_, { doc }) {
                        return findHashtags(doc)
                    },
                    apply(tr, old) {
                        return tr.docChanged ? findHashtags(tr.doc) : old
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state)
                    },
                },
            }),
        ]
    },
})

function findHashtags(doc: any) {
    const decorations: Decoration[] = []

    doc.descendants((node: any, pos: number) => {
        if (!node.isText) return

        const text = node.text
        // Regex for hashtags supporting Latin, Cyrillic, digits, and underscores
        // Using explicit ranges for broader compatibility if ES6 target is strict
        const regex = /#[\w\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]+/g

        let match
        while ((match = regex.exec(text)) !== null) {
            const start = pos + match.index
            const end = start + match[0].length

            decorations.push(
                Decoration.inline(start, end, {
                    class: 'text-blue-500 font-semibold', // Tailwind classes: blue text, slightly bold
                })
            )
        }
    })

    return DecorationSet.create(doc, decorations)
}

const Toolbar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) return null

    return (
        <div className="border-b border-input bg-transparent p-1 flex flex-wrap gap-1">
            <Button
                variant={editor.isActive('bold') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                variant={editor.isActive('italic') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic"
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Button
                variant={editor.isActive('underline') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                title="Underline"
            >
                <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
                variant={editor.isActive('strike') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
            >
                <Strikethrough className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 my-auto" />

            <Button
                variant={editor.isActive('heading', { level: 2 }) ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
            >
                <Heading2 className="h-4 w-4" />
            </Button>

            <Button
                variant={editor.isActive('bulletList') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet list"
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant={editor.isActive('orderedList') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Ordered list"
            >
                <ListOrdered className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 my-auto" />

            <Button
                variant={editor.isActive('blockquote') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Blockquote"
            >
                <Quote className="h-4 w-4" />
            </Button>
            <Button
                variant={editor.isActive('codeBlock') ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                title="Code block"
            >
                <Code className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 my-auto" />
            <VoiceInput
                onTranscription={(text) => {
                    editor.chain().focus().insertContent(text + ' ').run()
                }}
            />

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                title="Undo"
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                title="Redo"
            >
                <Redo className="h-4 w-4" />
            </Button>

        </div>
    )
}

import BubbleMenuExtension from '@tiptap/extension-bubble-menu'

export function RichEditor({ value, onChange, className, itemId, itemType }: RichEditorProps) {
    const [magicOpen, setMagicOpen] = useState(false)
    const [selectionText, setSelectionText] = useState('')
    const [bubblePos, setBubblePos] = useState<{ top: number, left: number } | null>(null)

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
            BubbleMenuExtension,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline underline-offset-4',
                },
            }),
            Underline,
            HashtagHighlighter,
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'min-h-[200px] w-full bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        onSelectionUpdate: ({ editor }) => {
            const { empty, from, to } = editor.state.selection
            if (empty || !editor.isEditable) {
                setBubblePos(null)
                return
            }

            // Calculate position using viewport coordinates
            const start = editor.view.coordsAtPos(from)
            const end = editor.view.coordsAtPos(to)

            // We use fixed positioning relative to viewport
            setBubblePos({
                top: end.bottom + 5,
                left: (start.left + end.right) / 2
            })
        },
        onBlur: () => {
            // Optional: Hide on blur? 
            // setBubblePos(null) 
            // Keeping it visible while focused is better.
        }
    })

    // Sync external value changes to editor (e.g. initial load)
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            if (editor.getText() === '' && value) {
                editor.commands.setContent(value)
            }
        }
    }, [value, editor])

    const handleMagicClick = (e: React.MouseEvent) => {
        e.preventDefault() // Prevent losing focus/selection
        e.stopPropagation()

        if (!editor) return
        const { from, to, empty } = editor.state.selection
        if (empty) return
        const text = editor.state.doc.textBetween(from, to, ' ')
        setSelectionText(text)
        setMagicOpen(true)
        setBubblePos(null) // Hide bubble
    }

    const handleMagicSave = (newText: string) => {
        if (editor) {
            // Convert plain text newlines to HTML paragraphs
            // This ensures Tiptap treats them as block nodes (paragraphs) instead of soft breaks
            const htmlContent = newText
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => `<p>${line}</p>`)
                .join('')

            editor.chain()
                .focus()
                .deleteSelection()
                .unsetAllMarks() // Remove bold/italic from potential previous selection
                .insertContent(htmlContent)
                .run()
        }
    }

    return (
        <div className={`flex flex-col border border-input rounded-md ${className}`}>
            <Toolbar editor={editor} />
            <div className="flex-1 overflow-y-auto relative">
                {editor && bubblePos && createPortal(
                    <div
                        className="fixed z-[99999] -translate-x-1/2 pt-2 animate-in zoom-in slide-in-from-top-2 duration-200 pointer-events-none"
                        style={{ top: bubblePos.top, left: bubblePos.left }}
                    >
                        <Button
                            size="sm"
                            onClick={handleMagicClick}
                            className="bg-background border shadow-lg hover:bg-muted text-purple-600 rounded-full h-8 px-3 gap-1.5 pointer-events-auto cursor-pointer"
                        >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Magic Edit</span>
                        </Button>
                    </div>,
                    document.body
                )}

                <EditorContent editor={editor} className="h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-4 [&_.ProseMirror]:outline-none [&_.ProseMirror>p]:my-2 [&_.ProseMirror>ul]:list-disc [&_.ProseMirror>ul]:pl-6 [&_.ProseMirror>ol]:list-decimal [&_.ProseMirror>ol]:pl-6 [&_.ProseMirror>blockquote]:border-l-4 [&_.ProseMirror>blockquote]:border-primary/50 [&_.ProseMirror>blockquote]:pl-4 [&_.ProseMirror>blockquote]:italic" />

                <MagicTextEditor
                    isOpen={magicOpen}
                    onOpenChange={setMagicOpen}
                    originalText={selectionText}
                    onSave={handleMagicSave}
                    itemId={itemId}
                    itemType={itemType}
                />
            </div>
        </div>
    )
}
