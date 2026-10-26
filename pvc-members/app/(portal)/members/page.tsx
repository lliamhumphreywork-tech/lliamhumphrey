import { db } from "@/lib/db"
import { MemberCard } from "@/components/members/MemberCard"

export const metadata = { title: "Members — PVC Members" }

export default async function MembersPage() {
  const members = await db.user.findMany({
    orderBy: [{ isOnline: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { posts: true } } },
  })

  const online = members.filter((m) => m.isOnline)
  const offline = members.filter((m) => !m.isOnline)

  return (
    <div className="page-container" style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Members
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 }}>
        {members.length} member{members.length !== 1 ? "s" : ""} in the club
      </p>

      {online.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
            Online now
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {online.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        </div>
      )}

      {offline.length > 0 && (
        <div>
          {online.length > 0 && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 12,
              }}
            >
              All members
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {offline.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
