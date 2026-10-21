import { auth } from "@/auth"
import { db } from "@/lib/db"
import { EventCard } from "@/components/events/EventCard"

export const metadata = { title: "Events — PVC Members" }

export default async function EventsPage() {
  const session = await auth()
  const userId = (session?.user?.id) ?? ""
  const role = (session?.user as any)?.role

  const now = new Date()
  const [upcomingEvents, upcomingCalls, past] = await Promise.all([
    db.event.findMany({
      where: { startDate: { gte: now }, eventType: "event" },
      orderBy: { startDate: "asc" },
      include: {
        rsvps: { include: { user: true } },
        _count: { select: { rsvps: true } },
      },
    }),
    db.event.findMany({
      where: { startDate: { gte: now }, eventType: "call" },
      orderBy: { startDate: "asc" },
      include: {
        rsvps: { include: { user: true } },
        _count: { select: { rsvps: true } },
      },
    }),
    db.event.findMany({
      where: { startDate: { lt: now } },
      orderBy: { startDate: "desc" },
      take: 5,
      include: {
        rsvps: { include: { user: true } },
        _count: { select: { rsvps: true } },
      },
    }),
  ])

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })
  const formatTime = (d: Date) =>
    new Date(d).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Events</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>In-person events and community calls</p>
        </div>
        {role === "ADMIN" && (
          <a
            href="/admin"
            style={{
              padding: "8px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            Manage events
          </a>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        {/* Left: In-person / online events */}
        <div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: "0.02em" }}>
            Upcoming events
          </h2>
          {upcomingEvents.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: "var(--radius)" }}>
              No upcoming events.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event as any} currentUserId={userId} isAdmin={role === "ADMIN"} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Community calls */}
        <div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: "0.02em" }}>
            Community calls
          </h2>
          {upcomingCalls.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: "var(--radius)" }}>
              No upcoming calls.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingCalls.map((call) => (
                <div
                  key={call.id}
                  style={{
                    padding: "16px 18px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <div style={{ fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {call.title}
                  </div>
                  {call.description && (
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
                      {call.description}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: call.meetingUrl ? 12 : 0 }}>
                    {formatDate(call.startDate)} · {formatTime(call.startDate)}
                  </div>
                  {call.meetingUrl && (
                    <a
                      href={call.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "7px 14px",
                        background: "var(--accent)",
                        color: "#000",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Join call
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Past events */}
      {past.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12 }}>
            Past events
          </h2>
          {past.map((event) => (
            <div key={event.id} style={{ opacity: 0.5 }}>
              <EventCard event={event as any} currentUserId={userId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
