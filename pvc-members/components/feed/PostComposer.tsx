"use client"

import { useState, useTransition, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Plus, ImagePlus, Paperclip, X } from "lucide-react"
import { upload } from "@vercel/blob/client"
import { Avatar } from "@/components/ui/Avatar"
import { RichTextEditor } from "@/components/editor/RichTextEditor"

type Attachment = { url: string; name: string; type: string; size: number }

type PostComposerProps = {
  spaceId?: string
  placeholder?: string
  composerAvatar?: string | null
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxDim = 1920
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.82)
    }
    img.src = url
  })
}

async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<Attachment> {
  if (file.type.startsWith("image/")) {
    onProgress?.(10)
    const compressed = await compressImage(file)
    onProgress?.(50)
    const fd = new FormData()
    fd.append("file", compressed, file.name.replace(/\.[^.]+$/, ".jpg"))
    const res = await fetch("/api/upload-image", { method: "POST", body: fd })
    if (!res.ok) throw new Error("Upload failed")
    const { url } = await res.json()
    onProgress?.(100)
    return { url, name: file.name, type: "image/jpeg", size: compressed.size }
  }
  const blob = await upload(file.name, file, {
    access: "private",
    handleUploadUrl: "/api/upload",
    onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
  })
  return { url: blob.url, name: file.name, type: file.type, size: file.size }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PostComposer({ spaceId, placeholder = "Share something with the community...", composerAvatar }: PostComposerProps) {
  const { data: session } = useSession()
  const [content, setContent] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [key, setKey] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const user = session?.user

  async function handleFiles(files: File[], imagesOnly = false) {
    if (!files.length) return
    setUploading(true)
    setUploadProgress(0)
    setError("")
    try {
      const uploaded = await Promise.all(
        files.slice(0, 4).map((f) => uploadFile(f, (pct) => setUploadProgress(pct)))
      )
      setAttachments((prev) => [...prev, ...uploaded].slice(0, 8))
    } catch {
      setError("Upload failed. Try again.")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  function reset() {
    setContent("")
    setAttachments([])
    setExpanded(false)
    setKey((k) => k + 1)
  }

  function handleSubmit() {
    const hasContent = content && content !== "<p></p>" && content.trim() !== ""
    if (!hasContent && attachments.length === 0) return
    setError("")

    startTransition(async () => {
      try {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: hasContent ? content : "",
            spaceId,
            attachments: attachments.map((a) => a.url),
          }),
        })
        if (!res.ok) throw new Error()
        reset()
        router.refresh()
      } catch {
        setError("Failed to post. Try again.")
      }
    })
  }

  const images = attachments.filter((a) => a.type.startsWith("image/"))
  const files = attachments.filter((a) => !a.type.startsWith("image/"))
  const hasContent = content && content !== "<p></p>" && content.trim() !== ""
  const canPost = (hasContent || attachments.length > 0) && !uploading

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      marginBottom: 16,
      overflow: "hidden",
    }}>
      <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={(e) => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />
      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
        onChange={(e) => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />

      {!expanded ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "text" }}
          onClick={() => setExpanded(true)}>
          <Avatar src={composerAvatar || user?.image} name={user?.name} size={34} role={(user as any)?.role} />
          <span style={{ flex: 1, fontSize: 14, color: "var(--text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", userSelect: "none" }}>
            {placeholder}
          </span>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
          }}>
            <Plus size={14} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, padding: "12px 16px 8px" }}>
            <Avatar src={composerAvatar || user?.image} name={user?.name} size={34} role={(user as any)?.role} />
            <div style={{
              flex: 1, minWidth: 0,
              border: "1px solid var(--accent)",
              borderRadius: "var(--radius)",
              background: "var(--bg-elevated)",
              overflow: "hidden",
            }}>
              <RichTextEditor key={key} placeholder={placeholder} onChange={setContent} onSubmit={handleSubmit} autofocus />
            </div>
          </div>

          {/* Image previews */}
          {images.length > 0 && (
            <div style={{ padding: "0 16px 10px 62px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {images.map((att, i) => (
                <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                  <img src={att.url} alt="" style={{
                    width: 80, height: 80, objectFit: "cover",
                    borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  }} />
                  <button type="button" onClick={() => removeAttachment(attachments.indexOf(att))}
                    style={{
                      position: "absolute", top: -6, right: -6,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "var(--bg-base)", border: "1px solid var(--border)",
                      color: "var(--text-muted)", display: "flex", alignItems: "center",
                      justifyContent: "center", cursor: "pointer", padding: 0,
                    }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File attachments */}
          {files.length > 0 && (
            <div style={{ padding: "0 16px 10px 62px", display: "flex", flexDirection: "column", gap: 6 }}>
              {files.map((att, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: "var(--radius-sm)",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                }}>
                  <Paperclip size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {att.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{formatBytes(att.size)}</span>
                  <button type="button" onClick={() => removeAttachment(attachments.indexOf(att))}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex" }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div style={{ padding: "0 16px 10px 62px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.2s ease" }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{uploadProgress}%</span>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ padding: "0 16px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={attachments.length >= 8}
              title="Add images"
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif",
              }}>
              <ImagePlus size={13} /> Photo
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={attachments.length >= 8}
              title="Attach file"
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif",
              }}>
              <Paperclip size={13} /> File
            </button>
            <div style={{ flex: 1 }} />
            {error && <span style={{ fontSize: 13, color: "var(--danger)" }}>{error}</span>}
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>⌘+Enter</span>
            <button type="button" onClick={reset}
              style={{
                padding: "7px 14px", background: "none", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-secondary)",
                cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif",
              }}>
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={isPending || !canPost}
              style={{
                padding: "7px 20px",
                background: canPost && !isPending ? "var(--accent)" : "var(--bg-elevated)",
                color: canPost && !isPending ? "#000" : "var(--text-muted)",
                border: "none", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
                fontFamily: "Plus Jakarta Sans, sans-serif",
                cursor: canPost && !isPending ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}>
              {isPending ? "Posting..." : "Post"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
