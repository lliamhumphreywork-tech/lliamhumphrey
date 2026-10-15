"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import type { User, Event } from "@prisma/client"
import { Shield, Plus, Trash2, Calendar } from "lucide-react"
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
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    location: "",
    isOnline: false,
    meetingUrl: "",
    startDate: "",
    endDate: "",
  })

  async function updateRole(userId: string, role: string) {
    await fetch(`/api/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    })
    router.refresh()
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
      setEventForm({ title: "", description: "", location: "", isOnline: false, meetingUrl: "", startDate: "", endDate: "" })
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
              <div style={{ display: "grid", gap: 12 }}>
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
              <div
                key={event.id}
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
                <button onClick={() => deleteEvent(event.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
