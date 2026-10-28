import Link from "next/link"
import { db } from "@/lib/db"
import { Avatar } from "@/components/ui/Avatar"
import { formatRelativeTime } from "@/lib/utils"
import { TrendingUp, ArrowUpRight } from "lucide-react"

export async function RightRail() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [onlineMembers, upcomingEvents, trendingPosts] = await Promise.all([
    db.user.findMany({
      where: { isOnline: true },
      take: 8,
      orderBy: { lastSeen: "desc" },
      select: { id: true, name: true, email: true, avatar: true, role: true },
    }),
    db.event.findMany({
      where: { startDate: { gte: new Date() } },
      take: 4,
      orderBy: { startDate: "asc" },
      select: { id: true, title: true, startDate: true, _count: { select: { rsvps: true } } },
    }),
    db.post.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      take: 4,
      orderBy: [
        { reactions: { _count: "desc" } },
        { comments: { _count: "desc" } },
      ],
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        _count: { select: { reactions: true, comments: true } },
      },
    }),
  ])

  return (
    <aside
      className="right-rail"
      style={{
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        overflow: "auto",
        padding: "20px 14px",
        flexDirection: "column",
        gap: 28,
        minHeight: 0,
      }}
    >
      {/* Online now */}
      {onlineMembers.length > 0 && (
        <section>
          <SectionHeader>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block", flexShrink: 0 }} />
              Online now
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {onlineMembers.length}</span>
            </span>
          </SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {onlineMembers.map((m) => (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                className="rr-member-link"
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  textDecoration: "none", padding: "5px 8px",
                  borderRadius: 8, transition: "background 0.1s",
                }}
              >
                <Avatar src={m.avatar} name={m.name} size={26} online role={m.role} />
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name ?? m.email.split("@")[0]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events */}
      <section>
        <SectionHeader right={
          <Link href="/events" className="rr-view-all" style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: 2 }}>
            All <ArrowUpRight size={10} />
          </Link>
        }>
          Upcoming events
        </SectionHeader>
        {upcomingEvents.length === 0 ? (
          <div style={{ padding: "14px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)" }}>
            No upcoming events.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {upcomingEvents.map((event) => {
              const d = new Date(event.startDate)
              const day = d.toLocaleDateString("en-ZA", { day: "numeric" })
              const month = d.toLocaleDateString("en-ZA", { month: "short" }).toUpperCase()
              return (
                <Link
                  key={event.id}
                  href={`/events#event-${event.id}`}
                  className="rr-event-card"
                  style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    padding: "10px 10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 10,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 30, paddingTop: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", lineHeight: 1, letterSpacing: "0.06em" }}>{month}</span>
                    <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, fontFamily: "Syne, sans-serif" }}>{day}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>
                      {event.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                      {d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                      {event._count.rsvps > 0 && ` · ${event._count.rsvps} going`}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Trending posts */}
      {trendingPosts.length > 0 && (
        <section>
          <SectionHeader>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={10} style={{ opacity: 0.5 }} />
              Trending this week
            </span>
          </SectionHeader>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {trendingPosts.map((post, i) => (
              <div
                key={post.id}
                style={{
                  display: "flex", gap: 9, alignItems: "flex-start",
                  padding: "9px 0",
                  borderBottom: i < trendingPosts.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
              >
                <Avatar src={post.author.avatar} name={post.author.name} size={24} role={post.author.role} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {post.author.name ?? post.author.email.split("@")[0]}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                    dangerouslySetInnerHTML={{ __html: post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) }}
                  />
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 8 }}>
                    {post._count.reactions > 0 && <span>{post._count.reactions} reactions</span>}
                    {post._count.comments > 0 && <span>{post._count.comments} comments</span>}
                    <span>{formatRelativeTime(post.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}

function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      marginBottom: 10,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span>{children}</span>
      {right}
    </div>
  )
}
