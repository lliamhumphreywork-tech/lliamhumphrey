"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold, Italic, UnderlineIcon, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Link as LinkIcon,
  Minus,
} from "lucide-react"
import { useEffect, useCallback } from "react"

type Props = {
  content?: string
  onChange?: (html: string) => void
  placeholder?: string
  onSubmit?: () => void
  autofocus?: boolean
}

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 4,
        border: "none",
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 0.1s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)" }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      {children}
    </button>
  )
}

const Divider = () => (
  <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 2px", flexShrink: 0 }} />
)

export function RichTextEditor({ content = "", onChange, placeholder = "Write something...", onSubmit, autofocus }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
    ],
    content,
    autofocus: false,
    editorProps: {
      attributes: { class: "pvc-editor" },
      handleKeyDown(_, event) {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          onSubmit?.()
          return true
        }
        return false
      },
    },
    onUpdate({ editor }) {
      onChange?.(editor.isEmpty ? "" : editor.getHTML())
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes("link").href ?? ""
    const url = window.prompt("URL", prev)
    if (url === null) return
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor])

  useEffect(() => {
    if (autofocus && editor) {
      // focus without triggering browser scroll-into-view
      requestAnimationFrame(() => {
        editor.commands.focus("end", { scrollIntoView: false })
      })
    }
  }, [autofocus, editor])

  useEffect(() => {
    return () => { editor?.destroy() }
  }, [editor])

  if (!editor) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "6px 8px",
          borderBottom: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (⌘B)">
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (⌘I)">
          <Italic size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (⌘U)">
          <UnderlineIcon size={13} />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 size={13} />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered size={13} />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
          <Quote size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
          <Code size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("link")} onClick={setLink} title="Add link">
          <LinkIcon size={13} />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus size={13} />
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  )
}
