"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, Users, Calendar, MessageSquare, Grid2x2, X, BookOpen, Network, MessageCircle } from "lucide-react"

const mainItems = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/members", icon: Users, label: "Members" },
  { href: "/events", icon: Calendar, label: "Events" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
]

const spaceItems = [
  { href: "/spaces/resources", icon: BookOpen, label: "Info Library" },
  { href: "/spaces/talent-network", icon: Network, label: "Talent Network" },
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
            style={{ position: "fixed", inset: 0, zIndex: 48, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          />
          <div style={{
            position: "fixed",
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
            left: 12, right: 12,
            zIndex: 49,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "8px 6px",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
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
                    padding: "13px 16px",
                    borderRadius: 10,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    textDecoration: "none", fontSize: 14, fontWeight: active ? 500 : 400,
                    background: active ? "rgba(255,255,255,0.05)" : "transparent",
                    transition: "background 0.1s",
                    letterSpacing: "0.01em",
                  }}
                >
                  <Icon size={16} strokeWidth={active ? 2 : 1.6} style={{ opacity: active ? 0.9 : 0.4 }} />
                  {label}
                </Link>
              )
            })}

            {/* Partner card */}
            <div style={{ padding: "8px 10px 4px" }}>
              <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 10 }} />
              <a
                href="https://chat.whatsapp.com/Dkq2UYM0pt45pZMvQWi4u5?mode=gi_t"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSpaces(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "Syne, sans-serif" }}>A</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "0.01em" }}>Arthur</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Financial Advisor</div>
                </div>
                <MessageCircle size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              </a>
            </div>
          </div>
        </>
      )}

      {/* Bottom nav bar */}
      <nav
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          paddingTop: 6,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "rgba(10,10,10,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid var(--border-subtle)",
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
                alignItems: "center", justifyContent: "center", gap: 4,
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                textDecoration: "none",
                fontSize: 9.5,
                fontWeight: active ? 500 : 400,
                paddingBottom: 6,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                position: "relative",
              }}
            >
              <Icon size={19} strokeWidth={active ? 2 : 1.5} />
              <span>{label}</span>
              {active && (
                <span style={{
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: 20, height: 2, borderRadius: 1,
                  background: "var(--text-primary)",
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
            alignItems: "center", justifyContent: "center", gap: 4,
            color: (isInSpaces || showSpaces) ? "var(--text-primary)" : "var(--text-muted)",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 9.5,
            fontWeight: (isInSpaces || showSpaces) ? 500 : 400,
            paddingBottom: 6,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            position: "relative",
          }}
        >
          {showSpaces ? <X size={19} strokeWidth={2} /> : <Grid2x2 size={19} strokeWidth={1.5} />}
          Spaces
          {(isInSpaces || showSpaces) && (
            <span style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: 20, height: 2, borderRadius: 1,
              background: "var(--text-primary)",
            }} />
          )}
        </button>
      </nav>
    </>
  )
}
