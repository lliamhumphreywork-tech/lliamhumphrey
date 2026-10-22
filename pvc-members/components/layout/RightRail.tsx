import Link from "next/link"
import { db } from "@/lib/db"
import { Avatar } from "@/components/ui/Avatar"
import { formatRelativeTime } from "@/lib/utils"
import { TrendingUp } from "lucide-react"

export async function RightRail() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [onlineMembers, upcomingEvents, trendingPosts] = await Promise.all([
    db.user.findMany({
      where: { isOnline: true },
      take: 8,
      orderBy: { lastSeen: "desc" },
    }),
    db.event.findMany({
      where: { startDate: { gte: new Date() } },
      take: 5,
      orderBy: { startDate: "asc" },
      include: { _count: { select: { rsvps: true } } },
    }),
    db.post.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      take: 5,
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
        padding: "24px 16px",
        flexDirection: "column",
        gap: 32,
        minHeight: 0,
      }}
    >
      {/* Online now */}
      {onlineMembers.length > 0 && (
        <section>
          <SectionHeader>
            <span
              style={{
                display: "inline-block",
                width: 6, height: 6,
                borderRadius: "50%",
                background: "var(--success)",
                marginRight: 6,
                verticalAlign: "middle",
              }}
            />
            Online now ({onlineMembers.length})
          </SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {onlineMembers.map((m) => (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                className="rr-member-link"
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  textDecoration: "none", padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <Avatar src={m.avatar} name={m.name} size={28} online role={m.role} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name ?? m.email.split("@")[0]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events */}
      <section>
        <SectionHeader right={<Link href="/events" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 500, letterSpacing: 0 }}>View all</Link>}>
          Upcoming events
        </SectionHeader>
        {upcomingEvents.length === 0 ? (
          <EmptyCard>
            No upcoming events.{" "}
            <Link href="/events" style={{ color: "var(--accent)", textDecoration: "none" }}>See all →</Link>
          </EmptyCard>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingEvents.map((event) => {
              const d = new Date(event.startDate)
              const day = d.toLocaleDateString("en-ZA", { day: "numeric" })
              const month = d.toLocaleDateString("en-ZA", { month: "short" }).toUpperCase()
              return (
                <Link
                  key={event.id}
                  href="/events"
                  className="rr-event-link rr-event-card"
                  style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    padding: "10px 10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius)",
                    textDecoration: "none",
                    transition: "border-color 0.1s",
                  }}
                >
                  {/* Date badge */}
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    minWidth: 32, paddingTop: 1,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", lineHeight: 1, letterSpacing: "0.05em" }}>{month}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, fontFamily: "Syne, sans-serif" }}>{day}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>
                      {event.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                      {d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })} · {event._count.rsvps} going
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
            <TrendingUp size={11} style={{ marginRight: 5, verticalAlign: "middle", opacity: 0.7 }} />
            Trending posts
          </SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trendingPosts.map((post) => (
              <div
                key={post.id}
                style={{
                  display: "flex", gap: 9, alignItems: "flex-start",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <Avatar
                  src={post.author.avatar}
                  name={post.author.name}
                  size={26}
                  role={post.author.role}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {post.author.name ?? post.author.email.split("@")[0]}
                  </div>
                  <div
                    style={{
                      fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100),
                    }}
                  />
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {post._count.reactions > 0 && `${post._count.reactions} reactions · `}
                    {post._count.comments > 0 && `${post._count.comments} comments · `}
                    {formatRelativeTime(post.createdAt)}
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
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      color: "var(--text-muted)", marginBottom: 10,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span>{children}</span>
      {right}
    </div>
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "14px 12px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius)",
      fontSize: 13, color: "var(--text-muted)",
    }}>
      {children}
    </div>
  )
}
