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
        padding: "20px",
        textDecoration: "none",
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)"
        e.currentTarget.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)"
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <Avatar
          src={member.avatar}
          name={member.name}
          size={48}
          online={member.isOnline}
          role={member.role}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: 15,
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
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
              <MapPin size={11} />
              {member.location}
            </div>
          )}
        </div>
      </div>

      {member.bio && (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 12,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {member.bio}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {member._count?.posts ?? 0} post{(member._count?.posts ?? 0) !== 1 ? "s" : ""}
        </span>
        {member.website && (
          <Globe size={13} style={{ color: "var(--text-muted)" }} />
        )}
      </div>
    </Link>
  )
}
