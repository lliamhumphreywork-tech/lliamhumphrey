"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, Users, Calendar, MessageSquare, Grid2x2, X, Trophy, BookOpen, Network, MessageCircle } from "lucide-react"

const mainItems = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/members", icon: Users, label: "Members" },
  { href: "/events", icon: Calendar, label: "Events" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
]

const spaceItems = [
  { href: "/spaces/wins", icon: Trophy, label: "Wins" },
  { href: "/spaces/resources", icon: BookOpen, label: "Info Library" },
  { href: "/spaces/talent-network", icon: Network, label: "Talent" },
]

export function MobileNav() {
  const pathname = usePathname()
  const [showSpaces, setShowSpaces] = useState(false)
  const isInSpaces = pathname.startsWith("/spaces")

  return (
    <>
      {/* Spaces drawer */}
      {showSpaces && (
        <>
          <div
            onClick={() => setShowSpaces(false)}
            style={{ position: "fixed", inset: 0, zIndex: 48, background: "rgba(0,0,0,0.5)" }}
          />
          <div style={{
            position: "fixed", bottom: "calc(60px + env(safe-area-inset-bottom, 0px))", left: 0, right: 0, zIndex: 49,
            background: "var(--bg-surface)", borderTop: "1px solid var(--border)",
            padding: "8px 0 4px",
          }}>
            {spaceItems.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setShowSpaces(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 24px",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    textDecoration: "none", fontSize: 15, fontWeight: active ? 600 : 400,
                    borderLeft: active ? "2px solid var(--nav-accent)" : "2px solid transparent",
                  }}
                >
                  <Icon size={18} style={{ opacity: active ? 1 : 0.5 }} />
                  {label}
                </Link>
              )
            })}

            {/* Arthur partner card */}
            <div style={{ padding: "8px 16px 4px" }}>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 8 }} />
              <a
                href="https://chat.whatsapp.com/Dkq2UYM0pt45pZMvQWi4u5?mode=gi_t"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSpaces(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  borderRadius: "var(--radius)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "var(--nav-accent-dim)", border: "1px solid var(--nav-accent)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--nav-accent)", fontFamily: "Syne, sans-serif" }}>A</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Arthur</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Financial Advisor</div>
                </div>
                <MessageCircle size={15} style={{ color: "var(--nav-accent)", flexShrink: 0 }} />
              </a>
            </div>
          </div>
        </>
      )}

      <nav
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          paddingTop: 4,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "rgba(8,8,8,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          zIndex: 50,
        }}
        className="mobile-nav"
      >
        {mainItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                color: active ? "#fff" : "var(--text-muted)",
                textDecoration: "none", fontSize: 10,
                fontWeight: active ? 600 : 400,
                paddingBottom: 2,
                position: "relative",
              }}
            >
              <div style={{ position: "relative" }}>
                <Icon size={21} strokeWidth={active ? 2 : 1.5} />
              </div>
              <span>{label}</span>
              {active && (
                <span style={{
                  position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
                  width: 4, height: 4, borderRadius: "50%",
                  background: "#45183F",
                }} />
              )}
            </Link>
          )
        })}

        {/* Spaces toggle */}
        <button
          onClick={() => setShowSpaces(s => !s)}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            color: (isInSpaces || showSpaces) ? "#fff" : "var(--text-muted)",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 10, fontWeight: (isInSpaces || showSpaces) ? 600 : 400,
            paddingBottom: 2, position: "relative",
          }}
        >
          {showSpaces ? <X size={21} strokeWidth={2} /> : <Grid2x2 size={21} strokeWidth={1.5} />}
          Spaces
          {(isInSpaces || showSpaces) && (
            <span style={{
              position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
              width: 4, height: 4, borderRadius: "50%",
              background: "#45183F",
            }} />
          )}
        </button>
      </nav>
    </>
  )
}
