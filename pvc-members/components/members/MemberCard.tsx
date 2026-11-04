"use client"

import Link from "next/link"
import { MapPin, Globe } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import type { User } from "@prisma/client"

type MemberCardProps = {
  member: User & { _count?: { posts: number } }
}

export function MemberCard({ member }: MemberCardProps) {
  return (
    <Link
      href={`/members/${member.id}`}
      style={{
        display: "block",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        textDecoration: "none",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)"
      }}
    >
      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        <Avatar
          src={member.avatar}
          name={member.name}
          size={48}
          online={member.isOnline}
          role={member.role}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {member.name ?? member.email.split("@")[0]}
            </span>
            <Badge role={member.role} />
          </div>
          {member.location && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-muted)", letterSpacing: "0.01em" }}>
              <MapPin size={10} />
              {member.location}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {member.bio && (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.65,
            marginBottom: 14,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {member.bio}
        </p>
      )}

      {/* Brings / Needs */}
      {(member.skills || member.seeking) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {member.skills && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{
                fontSize: 10, color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap",
                paddingTop: 2, letterSpacing: "0.08em", textTransform: "uppercase",
                minWidth: 42,
              }}>Brings</span>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{member.skills}</span>
            </div>
          )}
          {member.seeking && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{
                fontSize: 10, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap",
                paddingTop: 2, letterSpacing: "0.08em", textTransform: "uppercase",
                minWidth: 42,
              }}>Needs</span>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{member.seeking}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", letterSpacing: "0.02em" }}>
          {member._count?.posts ?? 0} post{(member._count?.posts ?? 0) !== 1 ? "s" : ""}
        </span>
        {member.website && (
          <Globe size={12} style={{ color: "var(--text-muted)" }} />
        )}
      </div>
    </Link>
  )
}
