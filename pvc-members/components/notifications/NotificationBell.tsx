"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Bell, MessageCircle, Smile, AtSign, Calendar, X } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { formatRelativeTime } from "@/lib/utils"

type Notification = {
  id: string
  type: string
  message: string
  read: boolean
  createdAt: string
  postId: string | null
  actor: { id: string; name: string | null; avatar: string | null; role: string } | null
}

const typeIcon: Record<string, React.ReactNode> = {
  comment: <MessageCircle size={12} />,
  reaction: <Smile size={12} />,
  mention: <AtSign size={12} />,
  event: <Calendar size={12} />,
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  async function fetchNotifications() {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) setNotifications(await res.json())
    } finally {
      setLoading(false)
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (open) {
      fetchNotifications()
      setTimeout(markAllRead, 1500)
    }
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (
        ref.current && !ref.current.contains(t) &&
        dropdownRef.current && !dropdownRef.current.contains(t)
      ) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={bellRef}
        onClick={() => {
          if (!open && bellRef.current) {
            const rect = bellRef.current.getBoundingClientRect()
            const isMobile = window.innerWidth < 768
            if (isMobile) {
              // Drop down from top header, anchored right
              setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
            } else {
              // Open to the right of the sidebar
              setDropdownPos({ bottom: window.innerHeight - rect.top + 8, left: rect.right + 12 })
            }
          }
          setOpen(!open)
        }}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: open ? "var(--bg-elevated)" : "transparent",
          color: open ? "var(--text-primary)" : "var(--text-muted)",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)" }}
        onMouseLeave={(e) => { if (!open) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)" } }}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: "var(--radius-full)",
              background: "var(--text-primary)",
              color: "var(--bg-base)",
              border: "2px solid var(--bg-surface)",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "Plus Jakarta Sans, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && dropdownPos && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            ...(dropdownPos.top !== undefined
              ? { top: dropdownPos.top, right: dropdownPos.right }
              : { bottom: dropdownPos.bottom, left: dropdownPos.left }
            ),
            width: Math.min(320, window.innerWidth - 16),
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 700 }}>
              Notifications
              {unread > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    background: "var(--accent)",
                    color: "#000",
                    borderRadius: "var(--radius-full)",
                    padding: "1px 7px",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  {unread}
                </span>
              )}
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <Bell size={24} style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block" }} />
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    background: n.read ? "transparent" : "rgba(212,168,67,0.04)",
                    transition: "background 0.15s",
                    cursor: n.postId ? "pointer" : "default",
                  }}
                  onClick={() => { if (n.postId) { window.location.href = `/feed#${n.postId}` } }}
                >
                  {/* Actor avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar src={n.actor?.avatar} name={n.actor?.name} size={32} role={n.actor?.role as any} />
                    <span
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                        fontSize: 8,
                      }}
                    >
                      {typeIcon[n.type] ?? <Bell size={8} />}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 3 }}>
                      {n.message}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatRelativeTime(new Date(n.createdAt))}
                    </p>
                  </div>

                  {!n.read && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
