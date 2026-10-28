"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { Avatar } from "@/components/ui/Avatar"
import { PushSubscribe } from "@/components/pwa/PushSubscribe"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export function MobileHeader() {
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
    <header className="mobile-header">
      <Link href="/profile" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
        <Avatar src={avatar || user?.image} name={user?.name} size={30} role={role} />
      </Link>

      <img
        src="/logo-horizontal.webp"
        alt="Private Victories"
        style={{ height: 22, width: "auto", display: "block" }}
      />

      <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
        <NotificationBell />
        <PushSubscribe iconOnly />
      </div>
    </header>
  )
}
