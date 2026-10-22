"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Camera } from "lucide-react"
import type { User } from "@prisma/client"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { uploadAvatar } from "@/lib/uploadAvatar"

function broadcastAvatar(src: string) {
  window.dispatchEvent(new CustomEvent("pvc:avatar-updated", { detail: src }))
}

const field = {
  width: "100%",
  padding: "11px 14px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  fontFamily: "Plus Jakarta Sans, sans-serif",
  transition: "border-color 0.15s",
} as const

export function ProfileForm({ user }: { user: User }) {
  const [form, setForm] = useState({
    name: user.name ?? "",
    bio: user.bio ?? "",
    location: user.location ?? "",
    website: user.website ?? "",
    twitter: user.twitter ?? "",
    instagram: user.instagram ?? "",
    linkedin: user.linkedin ?? "",
    avatar: user.avatar ?? "",
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { update: updateSession } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError("")
    try {
      const url = await uploadAvatar(file)
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: url }),
      })
      if (res.ok) {
        setForm((f) => ({ ...f, avatar: url }))
        broadcastAvatar(url)
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Failed to save photo. Try again.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Try a different image.")
    } finally {
      setUploadingAvatar(false)
      e.target.value = ""
    }
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        await updateSession({ name: form.name })
        if (form.avatar) broadcastAvatar(form.avatar)
      } else {
        setError("Failed to save. Try again.")
      }
    })
  }

  const Label = ({ children }: { children: string }) => (
    <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
      {children}
    </label>
  )

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{ marginBottom: 20 }}>{children}</div>
  )

  return (
    <form onSubmit={handleSubmit}>
      {/* Avatar section */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Clickable avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", position: "relative" }}
            >
              <Avatar src={form.avatar || user.avatar} name={form.name || user.name} size={72} role={user.role} />
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "rgba(0,0,0,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: uploadingAvatar ? 1 : 0,
                transition: "opacity 0.15s",
              }}
                onMouseEnter={(e) => { if (!uploadingAvatar) (e.currentTarget as HTMLElement).style.opacity = "1" }}
                onMouseLeave={(e) => { if (!uploadingAvatar) (e.currentTarget as HTMLElement).style.opacity = "0" }}
              >
                {uploadingAvatar
                  ? <div style={{ width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  : <Camera size={18} color="#fff" />
                }
              </div>
            </button>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 16 }}>
                {form.name || user.email.split("@")[0]}
              </span>
              <Badge role={user.role} />
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
              Member since {new Date(user.createdAt).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {uploadingAvatar ? "Uploading..." : "Click your photo to change it"}
            </p>
            {error && (
              <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 6 }}>{error}</p>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 20, color: "var(--text-secondary)" }}>
          Basic info
        </h2>

        <Row>
          <Label>Display name</Label>
          <input
            style={field}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Your name"
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </Row>

        <Row>
          <Label>Bio</Label>
          <textarea
            style={{ ...field, resize: "vertical", minHeight: 90 }}
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="A short intro about yourself and what you're building..."
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </Row>

        <Row>
          <Label>Location</Label>
          <input
            style={field}
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="Cape Town, South Africa"
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </Row>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 20, color: "var(--text-secondary)" }}>
          Links
        </h2>

        {[
          { key: "website", label: "Website", placeholder: "https://yoursite.com" },
          { key: "twitter", label: "Twitter / X", placeholder: "username (no @)" },
          { key: "instagram", label: "Instagram", placeholder: "username (no @)" },
          { key: "linkedin", label: "LinkedIn", placeholder: "username or URL" },
        ].map(({ key, label, placeholder }) => (
          <Row key={key}>
            <Label>{label}</Label>
            <input
              style={field}
              value={(form as any)[key]}
              onChange={(e) => update(key, e.target.value)}
              placeholder={placeholder}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </Row>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "11px 28px",
            background: isPending ? "var(--bg-elevated)" : "var(--accent)",
            color: isPending ? "var(--text-muted)" : "#000",
            border: "none",
            borderRadius: "var(--radius)",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "Plus Jakarta Sans, sans-serif",
            cursor: isPending ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
        {saved && (
          <span style={{ fontSize: 14, color: "var(--success)" }}>Saved</span>
        )}
      </div>
    </form>
  )
}
