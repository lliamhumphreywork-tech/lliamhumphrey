"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  MessageCircle, Flame, Dumbbell, HandMetal, Lightbulb, Heart,
  Plus, Trash2, Paperclip, Download, Pencil, Check, X,
} from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { formatRelativeTime } from "@/lib/utils"
import { getSpaceIcon } from "@/lib/spaceIcons"
import type { PostWithAll } from "@/lib/types"
import type { FC } from "react"
import type { LucideProps } from "lucide-react"

type Reaction = { emoji: string; label: string; Icon: FC<LucideProps> }
const REACTIONS: Reaction[] = [
  { emoji: "🔥", label: "Fire", Icon: Flame },
  { emoji: "💪", label: "Strong", Icon: Dumbbell },
  { emoji: "👏", label: "Clap", Icon: HandMetal },
  { emoji: "💡", label: "Idea", Icon: Lightbulb },
  { emoji: "❤️", label: "Love", Icon: Heart },
]

type PostCardProps = {
  post: PostWithAll
  currentUserId: string
  currentUserRole: string
}

export function PostCard({ post, currentUserId, currentUserRole }: PostCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [comment, setComment] = useState("")
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const editRef = useRef<HTMLDivElement>(null)
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
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditContent(post.content)
  }

  async function saveEdit() {
    const content = editRef.current?.innerHTML ?? ""
    if (!content.trim()) return
    setIsSaving(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
    setIsSaving(false)
    if (res.ok) {
      setIsEditing(false)
      router.refresh()
    }
  }

  const canEdit = post.authorId === currentUserId || currentUserRole === "ADMIN"
  const canDelete = canEdit

  return (
    <article
      className="fade-in"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        marginBottom: 12,
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
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

          {/* Edit / Delete actions */}
          {canEdit && !isEditing && (
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
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

        {/* Attachments */}
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

      {/* Reactions row */}
      <div
        style={{
          padding: "8px 16px 8px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {REACTIONS.map(({ emoji, label, Icon }) => {
          const { count, reacted } = reactionCounts[emoji]
          if (count === 0 && !showEmojiPicker) return null
          return (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              title={label}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 9px",
                background: reacted ? "var(--accent-dim)" : "var(--bg-elevated)",
                border: `1px solid ${reacted ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                color: reacted ? "var(--accent)" : "var(--text-muted)",
                transition: "all 0.1s",
              }}
            >
              <Icon size={12} />
              {count > 0 && <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "Plus Jakarta Sans, sans-serif" }}>{count}</span>}
            </button>
          )
        })}

        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="React"
          style={{
            display: "flex", alignItems: "center", padding: "3px 6px",
            background: showEmojiPicker ? "var(--accent-dim)" : "transparent",
            border: `1px solid ${showEmojiPicker ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--radius-full)",
            cursor: "pointer",
            color: showEmojiPicker ? "var(--accent)" : "var(--text-muted)",
            transition: "all 0.1s",
          }}
        >
          <Plus size={12} />
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setShowComments(!showComments)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "none", border: "none",
            color: showComments ? "var(--accent)" : "var(--text-muted)",
            fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
        >
          <MessageCircle size={14} />
          {post._count.comments > 0 ? `${post._count.comments} comment${post._count.comments !== 1 ? "s" : ""}` : "Comment"}
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
  )
}
