"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Video, Users, Calendar, ChevronDown, ChevronUp, Camera } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import type { EventWithRSVPs } from "@/lib/types"

type EventCardProps = {
  event: EventWithRSVPs
  currentUserId: string
  isAdmin?: boolean
}

export function EventCard({ event, currentUserId, isAdmin }: EventCardProps) {
  const [loading, setLoading] = useState(false)
  const [showAttendees, setShowAttendees] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverImage, setCoverImage] = useState(event.coverImage ?? "")
  const coverInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const hasRSVPd = event.rsvps.some((r) => r.userId === currentUserId)
  const start = new Date(event.startDate)

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
      const uploadRes = await fetch("/api/upload-image", { method: "POST", body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed")
      const { url } = uploadData
      await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: url }),
      })
      setCoverImage(url)
      router.refresh()
    } catch (err) {
      alert("Upload failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploadingCover(false)
      e.target.value = ""
    }
  }

  async function toggleRSVP() {
    setLoading(true)
    await fetch(`/api/events/${event.id}/rsvp`, {
      method: hasRSVPd ? "DELETE" : "POST",
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <div
      id={`event-${event.id}`}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: 12,
        scrollMarginTop: 24,
      }}
    >
      {/* Cover image */}
      <div style={{ position: "relative" }}>
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt=""
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
          />
        ) : isAdmin ? (
          <div
            style={{
              height: 80,
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
            }}
          />
        ) : null}
        {isAdmin && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleCoverUpload}
            />
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                backdropFilter: "blur(4px)",
              }}
            >
              <Camera size={11} />
              {uploadingCover ? "Uploading…" : coverImage ? "Change cover" : "Add cover"}
            </button>
          </>
        )}
      </div>
      {/* Date stripe */}
      <div
        style={{
          background: hasRSVPd ? "var(--accent-dim)" : "var(--bg-elevated)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Calendar size={14} style={{ color: hasRSVPd ? "var(--accent)" : "var(--text-muted)" }} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: hasRSVPd ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          {start.toLocaleDateString("en-ZA", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}{" "}
          at{" "}
          {start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div style={{ padding: "20px" }}>
        <h3
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 8,
            color: "var(--text-primary)",
          }}
        >
          {event.title}
        </h3>

        {event.description && (
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>
            {event.description}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          {event.isOnline ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
              <Video size={14} />
              Online
            </div>
          ) : event.location ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
              <MapPin size={14} />
              {event.location}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
            <Users size={14} />
            {event._count.rsvps} going
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={toggleRSVP}
            disabled={loading}
            style={{
              padding: "9px 20px",
              background: hasRSVPd ? "var(--accent-dim)" : "var(--accent)",
              color: hasRSVPd ? "var(--accent)" : "#000",
              border: hasRSVPd ? "1px solid var(--accent)" : "none",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "Plus Jakarta Sans, sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {loading ? "..." : hasRSVPd ? "Going (cancel)" : "RSVP"}
          </button>

          {event.isOnline && event.meetingUrl && hasRSVPd && (
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "9px 20px",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Join link
            </a>
          )}

          {isAdmin && event._count.rsvps > 0 && (
            <button
              onClick={() => setShowAttendees(!showAttendees)}
              style={{
                marginLeft: "auto",
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "7px 12px",
                fontSize: 12, color: "var(--text-secondary)", cursor: "pointer",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              {showAttendees ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {event._count.rsvps} going
            </button>
          )}
        </div>

        {/* Admin attendee list */}
        {isAdmin && showAttendees && event.rsvps.length > 0 && (
          <div style={{
            marginTop: 16,
            padding: "14px 16px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
              Attendees
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {event.rsvps.map((rsvp) => (
                <div key={rsvp.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar src={(rsvp.user as any).avatar} name={rsvp.user.name} size={28} role={(rsvp.user as any).role} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                      {rsvp.user.name ?? rsvp.user.email.split("@")[0]}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rsvp.user.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
