import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { PostCard } from "@/components/feed/PostCard"
import { MapPin, Globe, Twitter, Instagram, Linkedin, MessageSquare } from "lucide-react"

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const session = await auth()
  const currentUserId = (session?.user?.id) ?? ""
  const currentUserRole = (session!.user as any).role

  const member = await db.user.findUnique({
    where: { id: params.id },
    include: {
      posts: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          author: true,
          space: true,
          comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
          reactions: { include: { user: true } },
          _count: { select: { comments: true, reactions: true } },
        },
      },
      _count: { select: { posts: true, eventRSVPs: true } },
    },
  })

  if (!member) notFound()

  const isOwnProfile = member.id === currentUserId

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
      {/* Profile header */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          padding: "28px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <Avatar
            src={member.avatar}
            name={member.name}
            size={72}
            online={member.isOnline}
            role={member.role}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700 }}>
                {member.name ?? member.email.split("@")[0]}
              </h1>
              <Badge role={member.role} />
            </div>
            {member.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                <MapPin size={13} />
                {member.location}
              </div>
            )}
            <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
              <span><strong style={{ color: "var(--text-primary)" }}>{member._count.posts}</strong> posts</span>
              <span><strong style={{ color: "var(--text-primary)" }}>{member._count.eventRSVPs}</strong> events</span>
            </div>
          </div>

          {isOwnProfile ? (
            <Link
              href="/profile"
              style={{
                padding: "8px 16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary)",
                textDecoration: "none",
              }}
            >
              Edit profile
            </Link>
          ) : (
            <Link
              href={`/messages?with=${member.id}`}
              style={{
                padding: "8px 16px",
                background: "var(--accent)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 600,
                color: "#000",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MessageSquare size={13} />
              Message
            </Link>
          )}
        </div>

        {member.bio && (
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>
            {member.bio}
          </p>
        )}

        {(member.website || member.twitter || member.instagram || member.linkedin) && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {member.website && (
              <a href={member.website} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
                <Globe size={14} /> {member.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {member.twitter && (
              <a href={`https://twitter.com/${member.twitter}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
                <Twitter size={14} /> @{member.twitter}
              </a>
            )}
            {member.instagram && (
              <a href={`https://instagram.com/${member.instagram}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
                <Instagram size={14} /> @{member.instagram}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Posts */}
      {member.posts.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>
            Posts
          </h2>
          {member.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as any}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      )}
    </div>
  )
}
