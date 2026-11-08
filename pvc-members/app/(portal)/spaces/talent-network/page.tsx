"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Mail, Search, Trash2, Pencil, X, Instagram } from "lucide-react"
import { useSession } from "next-auth/react"

type TalentEntry = {
  id: string
  name: string
  email: string
  phone: string
  skills: string
  rate: string
  proof: string
  notes: string
  capacity: string
  member: string
  since: string
  roleOverride?: string
  availability?: string
  social?: string
  _manual?: boolean
}

const ROLES: { keys: string[]; label: string; color: string; bg: string; border: string }[] = [
  { keys: ["sales", "setter", "closer"],        label: "Sales",        color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)" },
  { keys: ["ads"],                               label: "Ads",          color: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.25)"  },
  { keys: ["editor"],                            label: "Editor",       color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.25)"  },
  { keys: ["videographer", "video"],             label: "Video",        color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)" },
  { keys: ["developer"],                         label: "Dev",          color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.25)"  },
  { keys: ["designer"],                          label: "Design",       color: "#f472b6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.25)" },
  { keys: ["copywriter", "copy"],                label: "Copy",         color: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.25)"  },
  { keys: ["operations", "ops", "systems"],      label: "Ops",          color: "#2dd4bf", bg: "rgba(45,212,191,0.10)",  border: "rgba(45,212,191,0.25)"  },
]

const DEFAULT_ROLE = { label: "Other", color: "#a8b8c8", bg: "rgba(168,184,200,0.08)", border: "rgba(168,184,200,0.20)" }

const ALL_ROLE_OPTIONS = [...ROLES.map(r => r.label), "Other"]

const AVAILABILITY_OPTIONS = ["Available", "Busy", "Not taking work"]

function getRole(entry: TalentEntry) {
  if (entry.roleOverride) {
    const match = ROLES.find(r => r.label.toLowerCase() === entry.roleOverride!.toLowerCase())
    return match ?? DEFAULT_ROLE
  }
  const s = (entry.skills ?? "").toLowerCase()
  return ROLES.find(r => r.keys.some(k => s.includes(k))) ?? DEFAULT_ROLE
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

function proofUrl(proof: string) {
  if (!proof) return null
  return proof.startsWith("http") ? proof : `https://${proof}`
}

function socialUrl(s: string) {
  if (!s) return null
  if (s.startsWith("http")) return s
  if (s.startsWith("@")) return `https://instagram.com/${s.slice(1)}`
  return `https://instagram.com/${s}`
}

export default function TalentNetworkPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [entries, setEntries] = useState<TalentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [editing, setEditing] = useState<TalentEntry | null>(null)

  useEffect(() => {
    fetch("/api/talent")
      .then(r => r.json())
      .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deleteEntry(id: string) {
    if (!confirm("Remove this entry?")) return
    await fetch("/api/talent", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function saveOverride(email: string, patch: { roleOverride?: string; availability?: string; social?: string }) {
    const res = await fetch("/api/talent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...patch }),
    })
    if (res.ok) {
      setEntries(prev => prev.map(e =>
        e.email === email ? { ...e, ...patch } : e
      ))
    }
  }

  const q = filter.toLowerCase()
  const filtered = entries.filter(e => {
    const role = getRole(e)
    const matchesSearch = !q ||
      e.name.toLowerCase().includes(q) ||
      e.skills.toLowerCase().includes(q) ||
      e.notes.toLowerCase().includes(q)
    const matchesRole = !activeRole || role.label === activeRole
    return matchesSearch && matchesRole
  })

  const presentRoleLabels = new Set(entries.map(e => getRole(e).label))
  const uniqueRoles = ROLES.filter(r => presentRoleLabels.has(r.label))

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "24px 16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
            Talent Network
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 18px" }}>
            Vetted talent you can hire into your business
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                  background: "var(--bg-elevated)", color: "var(--text-primary)",
                  fontSize: 16, outline: "none", width: 200,
                }}
              />
            </div>
            {uniqueRoles.map(r => (
              <button key={r.label} onClick={() => setActiveRole(activeRole === r.label ? null : r.label)}
                style={{
                  padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${activeRole === r.label ? r.color : "var(--border)"}`,
                  background: activeRole === r.label ? r.bg : "transparent",
                  color: activeRole === r.label ? r.color : "var(--text-muted)",
                  cursor: "pointer", fontFamily: "Plus Jakarta Sans, sans-serif", transition: "all 0.1s",
                }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 100px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: 200, borderRadius: "var(--radius-lg)",
                background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-muted)" }}>
            {filter || activeRole ? "No results." : "No talent entries yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map(entry => (
              <TalentCard
                key={entry.id}
                entry={entry}
                isAdmin={isAdmin}
                onDelete={deleteEntry}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <EditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await saveOverride(editing.email, patch)
            setEditing(null)
          }}
        />
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  )
}

function TalentCard({ entry, isAdmin, onDelete, onEdit }: {
  entry: TalentEntry
  isAdmin: boolean
  onDelete: (id: string) => void
  onEdit: (e: TalentEntry) => void
}) {
  const role = getRole(entry)
  const ini = initials(entry.name)
  const url = proofUrl(entry.proof)
  const igUrl = socialUrl(entry.social ?? "")

  const availColor =
    entry.availability === "Available" ? "#34d399" :
    entry.availability === "Busy" ? "#fbbf24" :
    entry.availability === "Not taking work" ? "#f87171" : null

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
    >
      <div style={{ height: 3, background: role.color, opacity: 0.7 }} />

      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Avatar + name + role chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: role.bg, border: `1.5px solid ${role.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: role.color, fontFamily: "Syne, sans-serif", flexShrink: 0,
          }}>
            {ini}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Syne, sans-serif", lineHeight: 1.2 }}>
              {entry.name}
            </div>
            {entry.since && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{entry.since}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            {availColor && (
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: availColor, flexShrink: 0 }} title={entry.availability} />
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 8px",
              borderRadius: 99, background: role.bg, color: role.color,
              border: `1px solid ${role.border}`,
            }}>
              {role.label}
            </span>
            {isAdmin && (
              <button onClick={() => onEdit(entry)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Rate */}
        {entry.rate && (
          <div style={{
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 500,
            background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)",
            padding: "5px 10px", border: "1px solid var(--border-subtle)",
          }}>
            {entry.rate}
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <p style={{
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0, flex: 1,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>
            {entry.notes}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {entry.email && (
          <a href={`mailto:${entry.email}`}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Mail size={12} />
          </a>
        )}
        {igUrl && (
          <a href={igUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", color: "var(--text-muted)", textDecoration: "none", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Instagram size={12} />
          </a>
        )}
        {entry.phone && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{entry.phone}</span>
        )}
        <div style={{ flex: 1 }} />
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: "var(--radius-sm)",
              border: `1px solid ${role.border}`, background: role.bg,
              fontSize: 11, fontWeight: 600, color: role.color, textDecoration: "none",
              transition: "opacity 0.1s", flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <ExternalLink size={11} /> View portfolio
          </a>
        )}
        {isAdmin && entry._manual && (
          <button onClick={() => onDelete(entry.id)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function EditModal({ entry, onClose, onSave }: {
  entry: TalentEntry
  onClose: () => void
  onSave: (patch: { roleOverride?: string; availability?: string; social?: string }) => Promise<void>
}) {
  const role = getRole(entry)
  const [roleOverride, setRoleOverride] = useState(entry.roleOverride ?? role.label)
  const [availability, setAvailability] = useState(entry.availability ?? "")
  const [social, setSocial] = useState(entry.social ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({ roleOverride, availability: availability || undefined, social: social || undefined })
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--bg-elevated)", color: "var(--text-primary)",
    fontSize: 14, outline: "none",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: 24, width: "100%", maxWidth: 400,
        display: "flex", flexDirection: "column", gap: 20,
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
              {entry.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{entry.email}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Role */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Role
          </label>
          <select value={roleOverride} onChange={e => setRoleOverride(e.target.value)} style={inputStyle}>
            {ALL_ROLE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Availability */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Availability
          </label>
          <select value={availability} onChange={e => setAvailability(e.target.value)} style={inputStyle}>
            <option value="">Not set</option>
            {AVAILABILITY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Social */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Instagram / Social
          </label>
          <input
            type="text"
            placeholder="@handle or link"
            value={social}
            onChange={e => setSocial(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 20px", borderRadius: "var(--radius-sm)",
            background: "var(--text-primary)", color: "var(--bg-base)",
            border: "none", fontSize: 13, fontWeight: 700,
            fontFamily: "Syne, sans-serif", cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1, transition: "opacity 0.15s",
          }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  )
}
