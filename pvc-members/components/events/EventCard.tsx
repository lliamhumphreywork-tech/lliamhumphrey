"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Video, Users, Calendar } from "lucide-react"
import type { EventWithRSVPs } from "@/lib/types"

type EventCardProps = {
  event: EventWithRSVPs
  currentUserId: string
  isAdmin?: boolean
}

export function EventCard({ event, currentUserId, isAdmin }: EventCardProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const hasRSVPd = event.rsvps.some((r) => r.userId === currentUserId)
  const start = new Date(event.startDate)

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
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
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
        </div>
      </div>
    </div>
  )
}
