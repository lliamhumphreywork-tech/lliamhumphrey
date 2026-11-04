"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import {
  Home, Users, Calendar, LogOut, Shield, Search,
  MessageCircle, BookOpen, Network, UserPlus,
} from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { PushSubscribe } from "@/components/pwa/PushSubscribe"

type SidebarGroup = {
  label: string
  items: { href: string; label: string; icon?: React.ElementType; external?: string }[]
}

const GROUPS: SidebarGroup[] = [
  {
    label: "Community",
    items: [
      { href: "/feed", label: "Feed", icon: Home },
      { href: "/members", label: "Members", icon: Users },
      { href: "/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "Spaces",
    items: [
      { href: "/spaces/talent-network", label: "Talent Network", icon: Network },
      { href: "/spaces/resources", label: "Info Library", icon: BookOpen },
    ],
  },
  {
    label: "Links",
    items: [
      {
        href: "#whatsapp",
        label: "WhatsApp Group",
        icon: MessageCircle,
        external: "https://chat.whatsapp.com/DuGhsjERYRPCsnxWSUU17L?mode=gi_t",
      },
    ],
  },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  external,
}: {
  href: string
  label: string
  icon?: React.ElementType
  active: boolean
  external?: string
}) {
  const sharedStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 12px",
    borderRadius: 9,
    marginBottom: 1,
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    textDecoration: "none",
    transition: "background 0.12s, color 0.12s",
    background: active ? "rgba(255,255,255,0.06)" : "transparent",
    letterSpacing: "0.01em",
  }

  const iconEl = Icon && (
    <Icon
      size={14}
      strokeWidth={active ? 2 : 1.6}
      style={{
        flexShrink: 0,
        opacity: active ? 0.9 : 0.35,
        transition: "opacity 0.12s",
      }}
    />
  )

  const textEl = (
    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {label}
    </span>
  )

  if (external) {
    return (
      <a
        href={external}
        target="_blank"
        rel="noopener noreferrer"
        style={sharedStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)"
          e.currentTarget.style.color = "var(--text-primary)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = "var(--text-secondary)"
        }}
      >
        {iconEl}{textEl}
      </a>
    )
  }

  return (
    <Link
      href={href}
      style={sharedStyle}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.03)"
          e.currentTarget.style.color = "var(--text-primary)"
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = "var(--text-secondary)"
        }
      }}
    >
      {iconEl}{textEl}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const role = (user as any)?.role ?? "GA"
  const [avatar, setAvatar] = useState<string | null>(null)

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
      <div style={{ padding: "24px 20px 20px" }}>
        <img
          src="/logo-horizontal.webp"
          alt="Private Victories"
          style={{ width: "80%", height: "auto", display: "block", opacity: 0.9 }}
        />
      </div>

      {/* Search */}
      <div style={{ padding: "0 12px 12px" }}>
        <button
          onClick={() => {
            const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
            document.dispatchEvent(e)
          }}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 12, cursor: "pointer", textAlign: "left",
            transition: "border-color 0.12s, background 0.12s",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border)"
            e.currentTarget.style.background = "rgba(255,255,255,0.02)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-subtle)"
            e.currentTarget.style.background = "transparent"
          }}
        >
          <Search size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Search</span>
          <kbd style={{
            fontSize: 10, background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-subtle)", borderRadius: 4,
            padding: "1px 5px", color: "var(--text-muted)", fontFamily: "inherit",
          }}>⌘K</kbd>
        </button>
      </div>

      {/* Grouped navigation */}
      <nav style={{ flex: 1, padding: "2px 0 8px", overflowY: "auto", minHeight: 0 }}>
        {GROUPS.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: gi < GROUPS.length - 1 ? 20 : 0 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "0 20px 6px",
              opacity: 0.5,
            }}>
              {group.label}
            </div>

            <div style={{ padding: "0 8px" }}>
              {group.items.map((item) => {
                const active = item.href !== "#whatsapp" &&
                  (pathname === item.href || pathname.startsWith(item.href + "/"))
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={active}
                    external={item.external}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Admin section */}
        {role === "ADMIN" && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--text-muted)",
              padding: "0 20px 6px", opacity: 0.5,
            }}>
              Admin
            </div>
            <div style={{ padding: "0 8px" }}>
              {[
                { href: "/admin", label: "Dashboard", icon: Shield },
                { href: "/admin/talent-import", label: "Talent Import", icon: UserPlus },
              ].map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} active={active} />
                )
              })}
            </div>
          </div>
        )}

        {/* Partner card */}
        <div style={{ padding: "24px 12px 4px" }}>
          <a
            href="https://chat.whatsapp.com/Dkq2UYM0pt45pZMvQWi4u5?mode=gi_t"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-subtle)",
              textDecoration: "none",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.background = "rgba(255,255,255,0.05)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)"
              e.currentTarget.style.background = "rgba(255,255,255,0.03)"
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "Syne, sans-serif" }}>A</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", lineHeight: 1.3 }}>Arthur</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.01em" }}>Financial Advisor</div>
            </div>
            <MessageCircle size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </a>
        </div>
      </nav>

      {/* User footer */}
      <div style={{
        padding: "12px 14px",
        borderTop: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/profile" style={{ flexShrink: 0 }}>
            <Avatar src={avatar || user?.image} name={user?.name} size={30} role={role} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
              {user?.name ?? user?.email?.split("@")[0]}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1 }}>
              {role === "ADMIN" ? "Admin" : "Member"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
            <PushSubscribe iconOnly />
            <NotificationBell />
            {role === "ADMIN" && (
              <Link href="/admin">
                <button
                  style={{ background: "none", border: "none", color: "var(--text-muted)", padding: "4px 5px", borderRadius: 6, display: "flex", cursor: "pointer", transition: "color 0.1s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                  title="Admin"
                >
                  <Shield size={13} />
                </button>
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ background: "none", border: "none", color: "var(--text-muted)", padding: "4px 5px", borderRadius: 6, display: "flex", cursor: "pointer", transition: "color 0.1s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)" }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
