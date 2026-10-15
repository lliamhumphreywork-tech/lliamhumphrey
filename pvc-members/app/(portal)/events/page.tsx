import { auth } from "@/auth"
import { db } from "@/lib/db"
import { EventCard } from "@/components/events/EventCard"

export const metadata = { title: "Events — PVC Members" }

export default async function EventsPage() {
  const session = await auth()
  const userId = (session?.user?.id) ?? ""
  const role = (session?.user as any)?.role

  const [upcoming, past] = await Promise.all([
    db.event.findMany({
      where: { startDate: { gte: new Date() } },
      orderBy: { startDate: "asc" },
      include: {
        rsvps: { include: { user: true } },
        _count: { select: { rsvps: true } },
      },
    }),
    db.event.findMany({
      where: { startDate: { lt: new Date() } },
      orderBy: { startDate: "desc" },
      take: 5,
      include: {
        rsvps: { include: { user: true } },
        _count: { select: { rsvps: true } },
      },
    }),
  ])

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Events</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>In-person and online</p>
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

      {upcoming.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
          No upcoming events. Check back soon.
        </div>
      ) : (
        <div style={{ marginBottom: 40 }}>
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event as any} currentUserId={userId} isAdmin={role === "ADMIN"} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12 }}>
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
