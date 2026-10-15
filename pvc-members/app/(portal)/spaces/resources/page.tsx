"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { upload } from "@vercel/blob/client"
import { Upload, Link2, FileText, File, Image, Film, Download, Trash2, ExternalLink, ChevronDown, X } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { formatRelativeTime } from "@/lib/utils"

type Resource = {
  id: string
  type: string
  title: string
  description?: string | null
  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
  createdAt: string
  uploadedBy: { id: string; name: string | null; avatar: string | null; role: string }
}

type AddMode = null | "file" | "link" | "text"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <Image size={18} />
  if (type.startsWith("video/")) return <Film size={18} />
  if (type.includes("pdf") || type.includes("document") || type.includes("text")) return <FileText size={18} />
  return <File size={18} />
}

function iconColor(type: string) {
  if (type.startsWith("image/")) return "#34d399"
  if (type.startsWith("video/")) return "#a78bfa"
  if (type.includes("pdf")) return "#f87171"
  if (type.includes("document") || type.includes("word")) return "#60a5fa"
  return "#a8b8c8"
}

export default function ResourcesPage() {
  const { data: session } = useSession()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFile, setUploadingFile] = useState<{ name: string; size: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  // form state
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; type: string; size: number } | null>(null)
  const [title, setTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [body, setBody] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const user = session?.user
  const role = (user as any)?.role ?? "GA"

  useEffect(() => {
    fetch("/api/resources")
      .then(r => r.json())
      .then(data => { setResources(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function openMode(mode: "file" | "link" | "text") {
    setAddMode(mode)
    setShowPicker(false)
    setError("")
    setTitle("")
    setLinkUrl("")
    setBody("")
    setPendingFile(null)
    if (mode === "file") fileInputRef.current?.click()
  }

  function cancelForm() {
    setAddMode(null)
    setPendingFile(null)
    setTitle("")
    setLinkUrl("")
    setBody("")
    setError("")
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    setUploadingFile({ name: file.name, size: file.size })
    setError("")
    try {
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
        onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
      })
      setPendingFile({ url: blob.url, name: file.name, type: file.type, size: file.size })
      setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))
      setAddMode("file")
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err)
      setError(`Upload failed: ${msg}`)
      setAddMode(null)
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setUploadingFile(null)
      e.target.value = ""
    }
  }

  async function handleSave() {
    setError("")
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { title, type: addMode }
      if (addMode === "file" && pendingFile) {
        payload.fileUrl = pendingFile.url
        payload.fileName = pendingFile.name
        payload.fileType = pendingFile.type
        payload.fileSize = pendingFile.size
        payload.description = body || null
      } else if (addMode === "link") {
        const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`
        payload.fileUrl = url
        payload.description = body || null
      } else if (addMode === "text") {
        payload.description = body
      }
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setResources(prev => [created, ...prev])
      cancelForm()
    } catch {
      setError("Failed to save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/resources/${id}`, { method: "DELETE" })
    if (res.ok) setResources(prev => prev.filter(r => r.id !== id))
  }

  const canSave = title.trim() &&
    ((addMode === "file" && pendingFile) ||
     (addMode === "link" && linkUrl.trim()) ||
     (addMode === "text" && body.trim()))

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
    fontSize: 13, outline: "none", fontFamily: "Plus Jakarta Sans, sans-serif",
    boxSizing: "border-box",
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <input ref={fileInputRef} type="file" accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.mp4,.mov,.m4v,.mp3,.m4a,.wav,.webm" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Header */}
      <div style={{ padding: "24px 16px 16px", borderBottom: "1px solid var(--border-subtle)" }} className="resources-header">
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
              Info Library
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              Files, links, and notes for the community
            </p>
          </div>

          {/* Add button with picker */}
          <div style={{ position: "relative" }}>
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, textAlign: "right", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {uploadProgress > 1 ? `${uploadProgress}%` : "Uploading…"}{uploadingFile ? ` · ${formatBytes(uploadingFile.size)}` : ""}
                </div>
                <div style={{
                  width: 180, height: 4, borderRadius: 99,
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  overflow: "hidden",
                }}>
                  {uploadProgress > 1 ? (
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: "var(--accent)",
                      width: `${uploadProgress}%`,
                      transition: "width 0.3s ease",
                    }} />
                  ) : (
                    <div style={{
                      height: "100%", width: "40%", borderRadius: 99,
                      background: "var(--accent)",
                      animation: "shimmer-bar 1.4s ease-in-out infinite",
                    }} />
                  )}
                </div>
                {uploadingFile && uploadingFile.size > 100 * 1024 * 1024 && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                    Large file — this may take a few minutes
                  </div>
                )}
              </div>
            ) : (
            <button
              onClick={() => setShowPicker(p => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 16px",
                background: "var(--accent)", color: "#000",
                border: "none", borderRadius: "var(--radius)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}>
              Add resource
              <ChevronDown size={14} />
            </button>
            )}

            {showPicker && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: 6, minWidth: 180,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}>
                {[
                  { mode: "file" as const, icon: <Upload size={14} />, label: "Upload file" },
                  { mode: "link" as const, icon: <Link2 size={14} />, label: "Add link" },
                  { mode: "text" as const, icon: <FileText size={14} />, label: "Write a note" },
                ].map(({ mode, icon, label }) => (
                  <button key={mode} onClick={() => openMode(mode)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "8px 12px", background: "none", border: "none",
                      borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
                      fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif",
                      textAlign: "left",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)" }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px 100px" }}>
        {error && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, padding: "10px 14px", marginBottom: 14,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
          }}>
            <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        )}

        {/* Add form — only show after upload completes */}
        {addMode && !uploading && (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--accent)",
            borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {addMode === "file" ? "Upload file" : addMode === "link" ? "Add link" : "Write a note"}
              </div>
              <button onClick={cancelForm} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {/* File preview */}
            {addMode === "file" && pendingFile && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)", marginBottom: 12,
              }}>
                <div style={{ color: iconColor(pendingFile.type) }}>
                  <FileIcon type={pendingFile.type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingFile.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatBytes(pendingFile.size)}</div>
                </div>
              </div>
            )}

            {/* Link URL */}
            {addMode === "link" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>URL *</label>
                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." style={fieldStyle} />
              </div>
            )}

            {/* Title */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                Title {addMode === "text" ? "*" : ""}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder={addMode === "file" ? (pendingFile?.name ?? "Title") : addMode === "link" ? "Link title" : "Note title"}
                style={fieldStyle} />
            </div>

            {/* Description / body */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                {addMode === "text" ? "Content *" : "Description (optional)"}
              </label>
              <textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder={addMode === "text" ? "Write your note here..." : "What is this for?"}
                rows={addMode === "text" ? 5 : 2}
                style={{ ...fieldStyle, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={cancelForm}
                style={{ padding: "7px 16px", background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={!canSave || saving}
                style={{
                  padding: "7px 20px",
                  background: canSave && !saving ? "var(--accent)" : "var(--bg-elevated)",
                  color: canSave && !saving ? "#000" : "var(--text-muted)",
                  border: "none", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
                  cursor: canSave && !saving ? "pointer" : "not-allowed", fontFamily: "Plus Jakarta Sans, sans-serif",
                }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 72, borderRadius: "var(--radius)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", opacity: 0.6, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : resources.length === 0 && !addMode ? (
          <div style={{ textAlign: "center", padding: "80px 24px", border: "1px dashed var(--border)", borderRadius: "var(--radius-lg)" }}>
            <Upload size={32} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>Nothing here yet. Add a file, link, or note.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {resources.map(r => <ResourceRow key={r.id} resource={r} userId={user?.id} userRole={role} onDelete={handleDelete} />)}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.6}50%{opacity:0.3} }`}</style>
    </div>
  )
}

function ResourceRow({ resource: r, userId, userRole, onDelete }: {
  resource: Resource
  userId?: string
  userRole: string
  onDelete: (id: string) => void
}) {
  const isOwner = r.uploadedBy.id === userId || userRole === "ADMIN"

  const icon = r.type === "link"
    ? <Link2 size={18} style={{ color: TYPE_COLORS.link }} />
    : r.type === "text"
    ? <FileText size={18} style={{ color: TYPE_COLORS.text }} />
    : <FileIcon type={r.fileType ?? ""} />

  const iconBg = r.type === "link"
    ? "rgba(96,165,250,0.10)"
    : r.type === "text"
    ? "rgba(251,191,36,0.10)"
    : "var(--bg-elevated)"

  const iconBorder = r.type === "link"
    ? "rgba(96,165,250,0.25)"
    : r.type === "text"
    ? "rgba(251,191,36,0.25)"
    : "var(--border-subtle)"

  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius)", padding: "14px 16px",
      transition: "border-color 0.1s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "var(--radius-sm)",
          background: iconBg, border: `1px solid ${iconBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          color: r.type === "file" ? iconColor(r.fileType ?? "") : undefined,
        }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
            {r.type === "link" && r.fileUrl ? (
              <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.color = "inherit")}>
                {r.title}
              </a>
            ) : r.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Avatar src={r.uploadedBy.avatar} name={r.uploadedBy.name} size={14} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {r.uploadedBy.name ?? "Member"} · {formatRelativeTime(r.createdAt)}
              {r.fileSize ? ` · ${formatBytes(r.fileSize)}` : ""}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {r.type === "text" && r.description && (
            <button onClick={() => setExpanded(x => !x)}
              style={{ padding: "5px 10px", background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {expanded ? "Hide" : "Read"}
            </button>
          )}
          {r.type === "link" && r.fileUrl && (
            <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", textDecoration: "none", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
              <ExternalLink size={11} /> Open
            </a>
          )}
          {r.type === "file" && r.fileUrl && (
            <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" download
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", textDecoration: "none", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
              <Download size={11} /> Download
            </a>
          )}
          {isOwner && (
            <button onClick={() => onDelete(r.id)}
              style={{ display: "flex", padding: "5px 8px", background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-muted)", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--danger)"; (e.currentTarget as HTMLElement).style.color = "var(--danger)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)" }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Expandable text content */}
      {r.type === "text" && r.description && expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
            {r.description}
          </p>
        </div>
      )}

      {/* Link description */}
      {r.type === "link" && r.description && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0 50px", lineHeight: 1.5 }}>{r.description}</p>
      )}
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  link: "#60a5fa",
  text: "#fbbf24",
}
