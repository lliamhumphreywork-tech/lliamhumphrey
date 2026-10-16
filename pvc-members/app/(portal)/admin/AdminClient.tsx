"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import type { User, Event } from "@prisma/client"
import { Shield, Plus, Trash2, Calendar, ImagePlus, X, Pencil } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

type Props = {
  members: (User & { _count: { posts: number } })[]
  events: (Event & { _count: { rsvps: number } })[]
}

const TAB_STYLES = (active: boolean) => ({
  padding: "8px 16px",
  background: active ? "var(--bg-elevated)" : "transparent",
  border: "1px solid " + (active ? "var(--border)" : "transparent"),
  borderRadius: "var(--radius-sm)",
  color: active ? "var(--text-primary)" : "var(--text-muted)",
  fontSize: 14,
  fontWeight: active ? 600 : 400,
  cursor: "pointer",
  fontFamily: "Plus Jakarta Sans, sans-serif",
})

export function AdminClient({ members, events }: Props) {
  const [tab, setTab] = useState<"members" | "events">("members")
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const editCoverInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    location: "",
    isOnline: false,
    meetingUrl: "",
    startDate: "",
    endDate: "",
    coverImage: "",
  })

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    location: "",
    isOnline: false,
    meetingUrl: "",
    startDate: "",
    endDate: "",
    coverImage: "",
  })

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = objectUrl })
      const maxDim = 1920
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio); height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width; canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85))
      const fd = new FormData()
      fd.append("file", blob, file.name.replace(/\.[^.]+$/, ".jpg"))
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      setEventForm((f) => ({ ...f, coverImage: url }))
    } catch {
      // silent — user can try again
    } finally {
      setUploadingCover(false)
      e.target.value = ""
    }
  }

  async function updateRole(userId: string, role: string) {
    await fetch(`/api/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    })
    router.refresh()
  }

  async function handleEditCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = objectUrl })
      const maxDim = 1920
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio); height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width; canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85))
      const fd = new FormData()
      fd.append("file", blob, file.name.replace(/\.[^.]+$/, ".jpg"))
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      setEditForm((f) => ({ ...f, coverImage: url }))
    } catch {
      // silent — user can try again
    } finally {
      setUploadingCover(false)
      e.target.value = ""
    }
  }

  function startEdit(event: Event & { _count: { rsvps: number } }) {
    setEditingEventId(event.id)
    const fmt = (d: Date | string) => {
      const date = new Date(d)
      const pad = (n: number) => String(n).padStart(2, "0")
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    setEditForm({
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      isOnline: event.isOnline,
      meetingUrl: event.meetingUrl ?? "",
      startDate: fmt(event.startDate),
      endDate: event.endDate ? fmt(event.endDate) : "",
      coverImage: event.coverImage ?? "",
    })
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await fetch(`/api/events/${editingEventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      setEditingEventId(null)
      router.refresh()
    })
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventForm),
      })
      setShowEventForm(false)
      setEventForm({ title: "", description: "", location: "", isOnline: false, meetingUrl: "", startDate: "", endDate: "", coverImage: "" })
      router.refresh()
    })
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return
    await fetch(`/api/events/${id}`, { method: "DELETE" })
    router.refresh()
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: 14,
    outline: "none",
    fontFamily: "Plus Jakarta Sans, sans-serif",
  } as const

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Shield size={20} style={{ color: "var(--accent)" }} />
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700 }}>Admin</h1>
      </div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 }}>
        Manage members and events
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        <button style={TAB_STYLES(tab === "members")} onClick={() => setTab("members")}>
          Members ({members.length})
        </button>
        <button style={TAB_STYLES(tab === "events")} onClick={() => setTab("events")}>
          Events ({events.length})
        </button>
      </div>

      {tab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <Avatar src={m.avatar} name={m.name} size={36} role={m.role} online={m.isOnline} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{m.name ?? m.email.split("@")[0]}</span>
                  <Badge role={m.role} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {m.email} · {m._count.posts} posts · joined {formatRelativeTime(m.createdAt)}
                </div>
              </div>
              <select
                value={m.role}
                onChange={(e) => updateRole(m.id, e.target.value)}
                style={{
                  padding: "6px 10px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                  outline: "none",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                <option value="GA">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {tab === "events" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={() => setShowEventForm(!showEventForm)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 18px",
                background: "var(--accent)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                color: "#000",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              <Plus size={14} /> New event
            </button>
          </div>

          {showEventForm && (
            <form
              onSubmit={createEvent}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "24px",
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                New event
              </h3>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
              <div style={{ display: "grid", gap: 12 }}>
                {/* Cover photo */}
                {eventForm.coverImage ? (
                  <div style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={eventForm.coverImage} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
                    <button type="button" onClick={() => setEventForm((f) => ({ ...f, coverImage: "" }))}
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "var(--bg-elevated)", border: "1px dashed var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    <ImagePlus size={15} />
                    {uploadingCover ? "Uploading..." : "Add cover photo (optional)"}
                  </button>
                )}
                <input style={inputStyle} placeholder="Event title *" value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} required />
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} placeholder="Description" value={eventForm.description} onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Start date & time *</label>
                    <input type="datetime-local" style={inputStyle} value={eventForm.startDate} onChange={(e) => setEventForm((f) => ({ ...f, startDate: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>End date & time</label>
                    <input type="datetime-local" style={inputStyle} value={eventForm.endDate} onChange={(e) => setEventForm((f) => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id="isOnline" checked={eventForm.isOnline} onChange={(e) => setEventForm((f) => ({ ...f, isOnline: e.target.checked }))} />
                  <label htmlFor="isOnline" style={{ fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>Online event</label>
                </div>
                {eventForm.isOnline ? (
                  <input style={inputStyle} placeholder="Meeting URL" value={eventForm.meetingUrl} onChange={(e) => setEventForm((f) => ({ ...f, meetingUrl: e.target.value }))} />
                ) : (
                  <input style={inputStyle} placeholder="Location" value={eventForm.location} onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))} />
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button type="submit" disabled={isPending} style={{ padding: "9px 20px", background: "var(--accent)", color: "#000", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  {isPending ? "Creating..." : "Create event"}
                </button>
                <button type="button" onClick={() => setShowEventForm(false)} style={{ padding: "9px 16px", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map((event) => (
              <div key={event.id}>
                {editingEventId === event.id ? (
                  <form onSubmit={saveEdit} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px" }}>
                    <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Edit event</h3>
                    <input ref={editCoverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleEditCoverUpload} />
                    <div style={{ display: "grid", gap: 12 }}>
                      {editForm.coverImage ? (
                        <div style={{ position: "relative" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editForm.coverImage} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
                          <button type="button" onClick={() => setEditForm((f) => ({ ...f, coverImage: "" }))}
                            style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => editCoverInputRef.current?.click()} disabled={uploadingCover}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "var(--bg-elevated)", border: "1px dashed var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          <ImagePlus size={15} />
                          {uploadingCover ? "Uploading..." : "Add cover photo (optional)"}
                        </button>
                      )}
                      <input style={inputStyle} placeholder="Event title *" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required />
                      <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} placeholder="Description" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Start *</label>
                          <input type="datetime-local" style={inputStyle} value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} required />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>End</label>
                          <input type="datetime-local" style={inputStyle} value={editForm.endDate} onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" id="editIsOnline" checked={editForm.isOnline} onChange={(e) => setEditForm((f) => ({ ...f, isOnline: e.target.checked }))} />
                        <label htmlFor="editIsOnline" style={{ fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>Online event</label>
                      </div>
                      {editForm.isOnline ? (
                        <input style={inputStyle} placeholder="Meeting URL" value={editForm.meetingUrl} onChange={(e) => setEditForm((f) => ({ ...f, meetingUrl: e.target.value }))} />
                      ) : (
                        <input style={inputStyle} placeholder="Location" value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                      <button type="submit" disabled={isPending} style={{ padding: "9px 20px", background: "var(--accent)", color: "#000", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                        {isPending ? "Saving..." : "Save changes"}
                      </button>
                      <button type="button" onClick={() => setEditingEventId(null)} style={{ padding: "9px 16px", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div style={{ width: 36, height: 36, background: "var(--accent-dim)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Calendar size={16} style={{ color: "var(--accent)" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{event.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(event.startDate).toLocaleDateString("en-ZA", { weekday: "short", month: "short", day: "numeric" })} · {event._count.rsvps} RSVPs
                      </div>
                    </div>
                    <button onClick={() => startEdit(event)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteEvent(event.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
