"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"

export function SplashScreen() {
  const { status } = useSession()

  useEffect(() => {
    if (status === "loading") return

    const el = document.getElementById("pvc-splash")
    if (!el) return

    // Fade out
    el.style.transition = "opacity 0.45s ease"
    el.style.opacity = "0"
    el.style.pointerEvents = "none"

    const timer = setTimeout(() => el.remove(), 500)
    return () => clearTimeout(timer)
  }, [status])

  return null
}
