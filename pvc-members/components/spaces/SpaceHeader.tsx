"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Settings, X, Check, MoreHorizontal } from "lucide-react"
import { getSpaceIcon } from "@/lib/spaceIcons"

type Space = {
  id: string
  slug: string
  name: string
  description: string | null
  emoji: string
  coverImage: string | null
  accentColor: string | null
  isPrivate: boolean
  _count: { posts: number; members: number }
}

const PRESET_COLORS = [
  "#a8b8c8", "#C9A84C", "#3B82F6", "#10B981",
  "#EF4444", "#06B6D4", "#8B5CF6", "#F59E0B",
]

export function SpaceHeader({ space: initialSpace, isAdmin }: { space: Space; isAdmin: boolean }) {
  const SpaceIcon = getSpaceIcon(initialSpace.slug)
  const [space, setSpace] = useState(initialSpace)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    name: space.name,
    description: space.description ?? "",
    coverImage: space.coverImage ?? "",
    accentColor: space.accentColor ?? "#a8b8c8",
  })
  const router = useRouter()

  const accent = space.accentColor ?? "var(--accent)"
  const hasCover = !!space.coverImage

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/spaces/${space.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description || null,
          emoji: space.emoji,
          coverImage: draft.coverImage || null,
          accentColor: draft.accentColor || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSpace({ ...space, ...updated })
        setEditing(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Cover image — only rendered when set */}
      {hasCover && (
        <div
          style={{
            height: 200,
            background: `url(${space.coverImage}) center/cover no-repeat`,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        />
      )}

      {/* Space page header — Circle-style */}
      <div
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 0" }}>
          {/* Icon + name row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Space icon */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `${typeof accent === "string" && accent.startsWith("#") ? accent + "18" : "var(--bg-elevated)"}`,
                  border: `1px solid ${typeof accent === "string" && accent.startsWith("#") ? accent + "35" : "var(--border)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <SpaceIcon size={20} style={{ color: accent }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontSize: 20,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      lineHeight: 1.2,
                    }}
                  >
                    {space.name}
                  </h1>
                  {space.isPrivate && <Lock size={13} style={{ color: "var(--text-muted)" }} />}
                </div>
                {space.description && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    {space.description}
                  </p>
                )}
              </div>
            </div>

            {/* Admin action */}
            {isAdmin && (
              <button
                onClick={() => {
                  setDraft({ name: space.name, description: space.description ?? "", coverImage: space.coverImage ?? "", accentColor: space.accentColor ?? "#a8b8c8" })
                  setEditing(true)
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                  cursor: "pointer",
                  flexShrink: 0,
                  letterSpacing: "0.02em",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)"
                  e.currentTarget.style.color = "var(--text-primary)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.color = "var(--text-secondary)"
                }}
              >
                <Settings size={12} /> Customize
              </button>
            )}
          </div>

          {/* Stats tab bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 24, paddingTop: 4 }}>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-primary)",
                fontWeight: 600,
                paddingBottom: 12,
                borderBottom: `2px solid ${accent}`,
              }}
            >
              Posts
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", paddingBottom: 12 }}>
              {space._count.posts} {space._count.posts === 1 ? "post" : "posts"}
            </div>
          </div>
        </div>
      </div>

      {/* Customize panel */}
      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            onClick={() => setEditing(false)}
          />
          <div
            style={{
              position: "relative",
              width: 340,
              height: "100vh",
              background: "var(--bg-elevated)",
              borderLeft: "1px solid var(--border)",
              overflowY: "auto",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 700 }}>Customize Space</span>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            <Field label="Name">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="Description">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label="Accent Color">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, accentColor: c })}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: c,
                      border: draft.accentColor === c ? "3px solid var(--text-primary)" : "2px solid transparent",
                      cursor: "pointer",
                      outline: draft.accentColor === c ? "2px solid var(--bg-elevated)" : "none",
                      outlineOffset: 1,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="color" value={draft.accentColor} onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })} style={{ width: 36, height: 36, border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer", padding: 2 }} />
                <input value={draft.accentColor} onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })} style={{ ...inputStyle, flex: 1 }} placeholder="#a8b8c8" />
              </div>
            </Field>

            <Field label="Cover Image URL">
              <input value={draft.coverImage} onChange={(e) => setDraft({ ...draft, coverImage: e.target.value })} placeholder="https://..." style={inputStyle} />
              {draft.coverImage && (
                <div style={{ marginTop: 8, borderRadius: 6, overflow: "hidden", height: 72 }}>
                  <img src={draft.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
            </Field>

            <button
              onClick={save}
              disabled={saving || !draft.name.trim()}
              style={{
                marginTop: "auto",
                padding: "10px 0",
                border: "none",
                background: "var(--accent)",
                color: "#000",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "Syne, sans-serif",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {saving ? "Saving..." : <><Check size={13} /> Save</>}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  fontFamily: "Plus Jakarta Sans, sans-serif",
  boxSizing: "border-box",
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
