"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import {
  Home, Users, Calendar, LogOut, Shield, Search,
  MessageCircle, Trophy, BookOpen,
  Network, UserPlus,
} from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { getSpaceIcon } from "@/lib/spaceIcons"

type SidebarGroup = {
  label: string
  items: { href: string; tag: string; label: string; icon?: React.ElementType; external?: string }[]
}

const GROUPS: SidebarGroup[] = [
  {
    label: "Community",
    items: [
      { href: "/feed", tag: "FD", label: "Feed", icon: Home },
      { href: "/members", tag: "MB", label: "Members", icon: Users },
      { href: "/events", tag: "EV", label: "Events", icon: Calendar },
      { href: "/spaces/wins", tag: "WN", label: "Wins", icon: Trophy },
    ],
  },
  {
    label: "Spaces",
    items: [
      { href: "/spaces/talent-network", tag: "TN", label: "Talent Network", icon: Network },
      { href: "/spaces/resources", tag: "RC", label: "Info Library", icon: BookOpen },
    ],
  },
  {
    label: "Links",
    items: [
      {
        href: "#whatsapp",
        tag: "WA",
        label: "WhatsApp Group",
        icon: MessageCircle,
        external: "https://chat.whatsapp.com/DuGhsjERYRPCsnxWSUU17L?mode=gi_t",
      },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const role = (user as any)?.role ?? "GA"
  const [avatar, setAvatar] = useState<string | null>(null)
  const [collapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!session) return
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((u) => { if (u?.avatar) setAvatar(u.avatar) })
      .catch(() => {})
  }, [session])

  useEffect(() => {
    const handler = (e: Event) => {
      const src = (e as CustomEvent<string>).detail
      if (src) setAvatar(src)
    }
    window.addEventListener("pvc:avatar-updated", handler)
    return () => window.removeEventListener("pvc:avatar-updated", handler)
  }, [])

  return (
    <aside
      className="sidebar"
      style={{
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 20px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
        <img
          src="/logo-horizontal.webp"
          alt="Private Victories"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      {/* Search */}
      <div style={{ padding: "8px 8px 4px" }}>
        <button
          onClick={() => {
            const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
            document.dispatchEvent(e)
          }}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-base)",
            color: "var(--text-muted)",
            fontSize: 13, cursor: "pointer", textAlign: "left",
          }}
        >
          <Search size={13} />
          <span style={{ flex: 1 }}>Search...</span>
          <kbd style={{ fontSize: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 4px" }}>⌘K</kbd>
        </button>
      </div>

      {/* Grouped navigation — this is the only scrollable region */}
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto", minHeight: 0 }}>
        {GROUPS.map((group, gi) => {
          const isCollapsed = collapsed[group.label]
          return (
            <div key={group.label} style={{ marginBottom: 2 }}>
              {/* Thin divider between groups — no text label */}
              {gi > 0 && (
                <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 16px 8px" }} />
              )}

              {/* Items */}
              {!isCollapsed && (
                <div style={{ padding: "2px 8px" }}>
                  {group.items.map((item) => {
                    const active = item.href !== "#whatsapp" &&
                      (pathname === item.href || pathname.startsWith(item.href + "/"))
                    const Icon = item.icon

                    if (item.external) {
                      return (
                        <a
                          key={item.href}
                          href={item.external}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", gap: 9,
                            padding: "6px 12px 6px 14px",
                            borderLeft: "2px solid transparent",
                            marginBottom: 1,
                            color: "var(--text-secondary)",
                            fontSize: 13.5, textDecoration: "none",
                            transition: "color 0.1s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)" }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)" }}
                        >
                          {Icon && <Icon size={15} style={{ opacity: 0.45, flexShrink: 0 }} />}
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.label}
                          </span>
                        </a>
                      )
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: "flex", alignItems: "center", gap: 9,
                          padding: "6px 12px 6px 14px",
                          borderLeft: active ? "2px solid var(--nav-accent)" : "2px solid transparent",
                          marginBottom: 1,
                          color: active ? "var(--text-primary)" : "var(--text-secondary)",
                          fontSize: 13.5, fontWeight: active ? 600 : 400,
                          textDecoration: "none", transition: "color 0.1s, border-color 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.color = "var(--text-primary)"
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.color = "var(--text-secondary)"
                        }}
                      >
                        {Icon && (
                          <Icon size={15} style={{ opacity: active ? 0.9 : 0.4, flexShrink: 0, color: active ? "var(--nav-accent)" : undefined }} />
                        )}
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

      {/* Admin section — inside nav so it scrolls with the rest */}
      {role === "ADMIN" && (
        <div style={{ padding: "4px 0" }}>
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 16px 8px" }} />
          <div style={{ padding: "2px 8px" }}>
            {[
              { href: "/admin", label: "Dashboard", icon: Shield },
              { href: "/admin/talent-import", label: "Talent Import", icon: UserPlus },
            ].map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/")
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "6px 12px 6px 14px",
                    borderLeft: active ? "2px solid var(--nav-accent)" : "2px solid transparent",
                    marginBottom: 1,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: 13.5, fontWeight: active ? 600 : 400,
                    textDecoration: "none", transition: "color 0.1s, border-color 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--text-primary)" }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--text-secondary)" }}
                >
                  <Icon size={15} style={{ opacity: active ? 0.9 : 0.4, flexShrink: 0, color: active ? "var(--nav-accent)" : undefined }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Partner — also inside nav so it scrolls */}
      <div style={{ padding: "8px 12px 12px" }}>
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 4px 10px" }} />
        <a
          href="https://chat.whatsapp.com/Dkq2UYM0pt45pZMvQWi4u5?mode=gi_t"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            textDecoration: "none", transition: "border-color 0.1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--nav-accent)" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)" }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--nav-accent-dim)", border: "1px solid var(--nav-accent)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nav-accent)", fontFamily: "Syne, sans-serif" }}>A</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>Arthur</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Financial Advisor</div>
          </div>
          <MessageCircle size={13} style={{ color: "var(--nav-accent)", flexShrink: 0 }} />
        </a>
      </div>
      </nav>

      {/* User footer — always visible, pinned to bottom outside the scroll region */}
      <div style={{ padding: "12px 12px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/profile">
            <Avatar src={avatar || user?.image} name={user?.name} size={32} role={role} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name ?? user?.email?.split("@")[0]}
            </div>
            <div style={{ fontSize: 11, color: role === "ADMIN" ? "var(--nav-accent)" : "var(--text-muted)", letterSpacing: "0.04em" }}>
              {role === "ADMIN" ? "Admin" : "Member"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <NotificationBell />
            {role === "ADMIN" && (
              <Link href="/admin">
                <button style={{ background: "none", border: "none", color: "var(--text-muted)", padding: 4, borderRadius: "var(--radius-sm)", display: "flex", cursor: "pointer" }} title="Admin">
                  <Shield size={15} />
                </button>
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ background: "none", border: "none", color: "var(--text-muted)", padding: 4, borderRadius: "var(--radius-sm)", display: "flex", cursor: "pointer" }}
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

