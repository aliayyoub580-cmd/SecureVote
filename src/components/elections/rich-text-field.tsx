import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

import { cn } from '@/lib/utils'

type RichTextFieldProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function RichTextField({ value, onChange, placeholder, disabled, className }: RichTextFieldProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Describe your election…' }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          'max-w-none min-h-[140px] px-3 py-2 text-sm leading-relaxed outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/40 rounded-b-xl',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const cur = editor.getHTML()
    if (value !== cur && (value || '<p></p>') !== cur) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) return <div className="h-36 animate-pulse rounded-xl bg-muted/40" aria-hidden />

  return (
    <div
      className={cn(
        'rounded-xl border border-input bg-background ring-offset-background',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <div className="flex flex-wrap gap-1 border-b border-border/60 bg-muted/30 px-2 py-1.5">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Bold">
          B
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Italic">
          I
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          label="Heading"
        >
          H2
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="List">
          •
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'rounded-lg px-2 py-1 text-xs font-semibold transition-colors',
        active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}
