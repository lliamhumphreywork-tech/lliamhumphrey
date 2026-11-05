"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  MessageCircle,
  Trash2, Paperclip, Download, Pencil, Check, X, Pin, PinOff, ImagePlus,
} from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { formatRelativeTime } from "@/lib/utils"
import { getSpaceIcon } from "@/lib/spaceIcons"
import type { PostWithAll } from "@/lib/types"

const REACTIONS = [
  { emoji: "🔥", label: "Fire" },
  { emoji: "💪", label: "Strong" },
  { emoji: "👏", label: "Clap" },
  { emoji: "💡", label: "Idea" },
  { emoji: "❤️", label: "Love" },
]

type PostCardProps = {
  post: PostWithAll
  currentUserId: string
  currentUserRole: string
}

export function PostCard({ post, currentUserId, currentUserRole }: PostCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState("")
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [editAttachments, setEditAttachments] = useState<string[]>((post as any).attachments ?? [])
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [addingPhoto, setAddingPhoto] = useState(false)
  const editRef = useRef<HTMLDivElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const addPhotoInputRef = useRef<HTMLInputElement>(null)
  const replacingIdxRef = useRef<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!lightboxSrc) return
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null) }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [lightboxSrc])

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus()
      // place cursor at end
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(editRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [isEditing])

  const reactionCounts = REACTIONS.reduce<Record<string, { count: number; reacted: boolean }>>((acc, { emoji }) => {
    const reactions = post.reactions.filter((r) => r.emoji === emoji)
    acc[emoji] = {
      count: reactions.length,
      reacted: reactions.some((r) => r.userId === currentUserId),
    }
    return acc
  }, {})

  async function react(emoji: string) {
    await fetch(`/api/posts/${post.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    })
    router.refresh()
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    startTransition(async () => {
      await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      })
      setComment("")
      router.refresh()
    })
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" })
    router.refresh()
  }

  function startEdit() {
    setEditContent(post.content)
    setEditAttachments((post as any).attachments ?? [])
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditContent(post.content)
    setEditAttachments((post as any).attachments ?? [])
  }

  async function saveEdit() {
    const content = editRef.current?.innerHTML ?? ""
    setIsSaving(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content || post.content, attachments: editAttachments }),
    })
    setIsSaving(false)
    if (res.ok) {
      setIsEditing(false)
      router.refresh()
    }
  }

  async function uploadAndReplace(file: File, idx: number) {
    setUploadingIdx(idx)
    try {
      const fd = new FormData()
      const img = new Image()
      const url = URL.createObjectURL(file)
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const max = 1920
          let { width, height } = img
          if (width > max || height > max) {
            const r = Math.min(max / width, max / height)
            width = Math.round(width * r); height = Math.round(height * r)
          }
          const canvas = document.createElement("canvas")
          canvas.width = width; canvas.height = height
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
          URL.revokeObjectURL(url)
          canvas.toBlob((blob) => {
            fd.append("file", blob!, file.name.replace(/\.[^.]+$/, ".jpg"))
            resolve()
          }, "image/jpeg", 0.82)
        }
        img.src = url
      })
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      if (!res.ok) throw new Error()
      const { url: newUrl } = await res.json()
      setEditAttachments(prev => prev.map((a, i) => i === idx ? newUrl : a))
    } catch {
      // silent — keep old image
    } finally {
      setUploadingIdx(null)
    }
  }

  async function uploadAndAdd(file: File) {
    setAddingPhoto(true)
    try {
      const fd = new FormData()
      const img = new Image()
      const url = URL.createObjectURL(file)
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const max = 1920
          let { width, height } = img
          if (width > max || height > max) {
            const r = Math.min(max / width, max / height)
            width = Math.round(width * r); height = Math.round(height * r)
          }
          const canvas = document.createElement("canvas")
          canvas.width = width; canvas.height = height
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
          URL.revokeObjectURL(url)
          canvas.toBlob((blob) => {
            fd.append("file", blob!, file.name.replace(/\.[^.]+$/, ".jpg"))
            resolve()
          }, "image/jpeg", 0.82)
        }
        img.src = url
      })
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      if (!res.ok) throw new Error()
      const { url: newUrl } = await res.json()
      setEditAttachments(prev => [...prev, newUrl])
    } catch {
      // silent
    } finally {
      setAddingPhoto(false)
    }
  }

  const canEdit = post.authorId === currentUserId || currentUserRole === "ADMIN"
  const canDelete = canEdit
  const canPin = currentUserRole === "ADMIN"
  const [pinned, setPinned] = useState(post.isPinned)
  const [pinBusy, setPinBusy] = useState(false)

  async function togglePin() {
    setPinBusy(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !pinned }),
    })
    if (res.ok) {
      setPinned(!pinned)
      router.refresh()
    }
    setPinBusy(false)
  }

  return (
    <>
    <input ref={replaceInputRef} type="file" accept="image/*" style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files?.[0]
        const idx = replacingIdxRef.current
        e.target.value = ""
        if (file && idx !== null) uploadAndReplace(file, idx)
      }} />
    <input ref={addPhotoInputRef} type="file" accept="image/*" style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (file) uploadAndAdd(file)
      }} />
    <article
      className={`fade-in${pinned ? "" : " post-card"}`}
      style={{
        background: "var(--bg-surface)",
        border: pinned ? "1px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        marginBottom: 12,
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
      {/* Pinned indicator */}
      {pinned && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 16px",
          background: "var(--accent-dim)",
          borderBottom: "1px solid var(--accent)",
          fontSize: 11, fontWeight: 600, color: "var(--accent)",
          letterSpacing: "0.05em", textTransform: "uppercase",
          fontFamily: "Plus Jakarta Sans, sans-serif",
        }}>
          <Pin size={11} /> Pinned post
        </div>
      )}

      {/* Post header */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <Link href={`/members/${post.author.id}`}>
            <Avatar
              src={post.author.avatar}
              name={post.author.name}
              size={38}
              role={post.author.role}
            />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Link
                href={`/members/${post.author.id}`}
                style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
              >
                {post.author.name ?? post.author.email.split("@")[0]}
              </Link>
              <Badge role={post.author.role} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {formatRelativeTime(post.createdAt)}
              </span>
              {post.space && (() => {
                const SI = getSpaceIcon(post.space.slug)
                return (
                  <>
                    <span style={{ fontSize: 11, color: "var(--border)" }}>·</span>
                    <Link
                      href={`/spaces/${post.space.slug}`}
                      style={{
                        fontSize: 12, color: "var(--accent)", textDecoration: "none",
                        display: "flex", alignItems: "center", gap: 3,
                        fontWeight: 500,
                      }}
                    >
                      <SI size={11} /> Posted in {post.space.name}
                    </Link>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Edit / Delete / Pin actions */}
          {(canEdit || canPin) && !isEditing && (
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              {canPin && (
                <button
                  onClick={togglePin}
                  disabled={pinBusy}
                  title={pinned ? "Unpin post" : "Pin post"}
                  style={{
                    background: pinned ? "var(--accent-dim)" : "none",
                    border: "none",
                    color: pinned ? "var(--accent)" : "var(--text-muted)",
                    padding: 4, cursor: pinBusy ? "not-allowed" : "pointer",
                    borderRadius: "var(--radius-sm)", display: "flex",
                    opacity: pinBusy ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { if (!pinned) e.currentTarget.style.color = "var(--accent)" }}
                  onMouseLeave={(e) => { if (!pinned) e.currentTarget.style.color = "var(--text-muted)" }}
                >
                  {pinned ? <PinOff size={13} /> : <Pin size={13} />}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={startEdit}
                  title="Edit post"
                  style={{
                    background: "none", border: "none", color: "var(--text-muted)",
                    padding: 4, cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <Pencil size={13} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={deletePost}
                  title="Delete post"
                  style={{
                    background: "none", border: "none", color: "var(--text-muted)",
                    padding: 4, cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}

          {/* Save / Cancel when editing */}
          {isEditing && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              <button
                onClick={cancelEdit}
                title="Cancel"
                style={{
                  background: "none", border: "1px solid var(--border)",
                  color: "var(--text-muted)", padding: "3px 10px",
                  cursor: "pointer", borderRadius: "var(--radius-sm)",
                  fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                <X size={12} /> Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                title="Save changes"
                style={{
                  background: "var(--accent)", border: "none",
                  color: "#000", padding: "3px 10px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                  fontFamily: "Plus Jakarta Sans, sans-serif", opacity: isSaving ? 0.7 : 1,
                }}
              >
                <Check size={12} /> {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Content — editable or read-only */}
        {isEditing ? (
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: editContent }}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelEdit()
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit()
            }}
            style={{
              fontSize: 15, lineHeight: 1.7, color: "var(--text-primary)",
              marginBottom: 14, minHeight: 60,
              background: "var(--bg-elevated)",
              border: "1px solid var(--accent)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
              outline: "none",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          />
        ) : (
          post.content && (
            <div
              className="post-content prose"
              dangerouslySetInnerHTML={{ __html: post.content }}
              style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-primary)", marginBottom: 14 }}
            />
          )
        )}
        {isEditing && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
            ⌘+Enter to save · Esc to cancel
          </p>
        )}

        {/* Attachments — editable in edit mode */}
        {isEditing && (
          <div style={{ marginBottom: 12 }}>
            {editAttachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {editAttachments.map((src, i) => {
                  const proxied = src.includes("blob.vercel-storage.com") && !src.includes(".public.")
                    ? `/api/img?url=${encodeURIComponent(src)}` : src
                  const isUploading = uploadingIdx === i
                  return (
                    <div key={i} className="edit-img-thumb" style={{ position: "relative", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proxied} alt=""
                        style={{
                          width: 80, height: 80, objectFit: "cover",
                          borderRadius: "var(--radius)", border: "1px solid var(--border)",
                          display: "block", opacity: isUploading ? 0.4 : 1,
                        }} />
                      {/* Replace overlay — always shown on mobile, hover on desktop */}
                      {!isUploading && (
                        <button
                          type="button"
                          className="edit-img-replace"
                          onClick={() => { replacingIdxRef.current = i; replaceInputRef.current?.click() }}
                          style={{
                            position: "absolute", inset: 0, borderRadius: "var(--radius)",
                            background: "rgba(0,0,0,0.55)", border: "none",
                            color: "#fff", fontSize: 10, fontWeight: 600,
                            fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.04em",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                          Replace
                        </button>
                      )}
                      {isUploading && (
                        <div style={{
                          position: "absolute", inset: 0, display: "flex",
                          alignItems: "center", justifyContent: "center",
                          borderRadius: "var(--radius)",
                        }}>
                          <div style={{ width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        </div>
                      )}
                      {/* Remove */}
                      <button type="button"
                        onClick={() => setEditAttachments(prev => prev.filter((_, j) => j !== i))}
                        style={{
                          position: "absolute", top: -6, right: -6,
                          width: 18, height: 18, borderRadius: "50%",
                          background: "var(--bg-base)", border: "1px solid var(--border)",
                          color: "var(--text-muted)", display: "flex", alignItems: "center",
                          justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 2,
                        }}>
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <button type="button"
              onClick={() => addPhotoInputRef.current?.click()}
              disabled={addingPhoto}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px", background: "none",
                border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
                fontFamily: "Plus Jakarta Sans, sans-serif",
                opacity: addingPhoto ? 0.5 : 1,
              }}>
              <ImagePlus size={12} /> {addingPhoto ? "Uploading…" : "Add photo"}
            </button>
          </div>
        )}

        {/* Attachments — read-only view */}
        {!isEditing && (post as any).attachments?.length > 0 && (() => {
          const atts: string[] = (post as any).attachments
          // Proxy any private Vercel Blob URLs (no ".public." in hostname)
          function imgSrc(url: string) {
            if (url.startsWith("/api/img")) return url
            if (url.includes("blob.vercel-storage.com") && !url.includes(".public.blob.vercel-storage.com")) {
              return `/api/img?url=${encodeURIComponent(url)}`
            }
            return url
          }
          const imgs = atts.filter(u => /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(u) || u.startsWith("/api/img"))
          const docs = atts.filter(u => !imgs.includes(u))
          return (
            <div style={{ marginBottom: 14 }}>
              {imgs.length > 0 && (
                <div className="post-images" style={{ cursor: "zoom-in" }}>
                  {imgs.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={imgSrc(src)} alt="" className="post-image"
                      style={{ borderRadius: "var(--radius)", border: "1px solid var(--border-subtle)" }}
                      onClick={() => setLightboxSrc(imgSrc(src))}
                    />
                  ))}
                </div>
              )}
              {docs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: imgs.length > 0 ? 8 : 0 }}>
                  {docs.map((url, i) => {
                    const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "File")
                    const dlHref = url.includes("blob.vercel-storage.com")
                      ? `/api/dl?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
                      : url
                    return (
                      <a key={i} href={dlHref} target="_blank" rel="noopener noreferrer" download
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 12px", borderRadius: "var(--radius-sm)",
                          background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          textDecoration: "none", color: "var(--text-secondary)",
                          fontSize: 13, transition: "border-color 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      >
                        <Paperclip size={13} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        <Download size={13} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Reactions + comment row */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
        }}
      >
        {REACTIONS.map(({ emoji, label }) => {
          const { count, reacted } = reactionCounts[emoji]
          return (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              title={label}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px",
                minHeight: 32,
                background: reacted ? "var(--accent-dim)" : "var(--bg-elevated)",
                border: `1px solid ${reacted ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                transition: "all 0.12s",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
              {count > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                  color: reacted ? "var(--accent)" : "var(--text-secondary)",
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setShowComments(!showComments)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", minHeight: 32,
            background: "none", border: "none",
            color: showComments ? "var(--text-primary)" : "var(--text-muted)",
            fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif",
            flexShrink: 0,
          }}
        >
          <MessageCircle size={14} />
          {post._count.comments > 0 ? post._count.comments : ""}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "12px 16px", background: "var(--bg-elevated)" }}>
          {post.comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Avatar src={c.author.avatar} name={c.author.name} size={28} role={c.author.role} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {c.author.name ?? c.author.email.split("@")[0]}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatRelativeTime(c.createdAt)}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {c.content}
                </p>
              </div>
            </div>
          ))}

          <form onSubmit={addComment} style={{ display: "flex", gap: 10 }}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              style={{
                flex: 1, background: "var(--bg-surface)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-full)",
                padding: "8px 14px", fontSize: 16, color: "var(--text-primary)",
                outline: "none", fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={!comment.trim() || isPending}
              style={{
                padding: "8px 16px",
                background: comment.trim() ? "var(--accent)" : "var(--bg-surface)",
                color: comment.trim() ? "#000" : "var(--text-muted)",
                border: "none", borderRadius: "var(--radius-full)",
                fontSize: 13, fontWeight: 600,
                cursor: comment.trim() ? "pointer" : "not-allowed",
                fontFamily: "Plus Jakarta Sans, sans-serif", transition: "all 0.15s",
              }}
            >
              Reply
            </button>
          </form>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out", backdropFilter: "blur(4px)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            style={{
              maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain",
              borderRadius: "var(--radius-lg)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: "absolute", top: 20, right: 20,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%", width: 36, height: 36,
              color: "#fff", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </article>
    </>
  )
}
