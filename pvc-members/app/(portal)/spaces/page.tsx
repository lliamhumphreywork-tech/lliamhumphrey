import Link from "next/link"
import { db } from "@/lib/db"
import { auth } from "@/auth"
import { Lock } from "lucide-react"
import { getSpaceIcon } from "@/lib/spaceIcons"

export const metadata = { title: "Spaces — PVC Members" }

export default async function SpacesPage() {
  const session = await auth()
  const role = (session!.user as any).role

  const spaces = await db.space.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { posts: true, members: true } },
    },
  })

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Spaces
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 }}>
        Focused rooms for different conversations
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {spaces.map((space) => {
          const SpaceIcon = getSpaceIcon(space.slug)
          return (
            <Link
              key={space.id}
              href={`/spaces/${space.slug}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 20px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                textDecoration: "none",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <SpaceIcon size={18} style={{ color: "var(--accent)", opacity: 0.8 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                    {space.name}
                  </span>
                  {space.isPrivate && <Lock size={12} style={{ color: "var(--text-muted)" }} />}
                </div>
                {space.description && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {space.description}
                  </p>
                )}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>
                {space._count.posts} posts
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
