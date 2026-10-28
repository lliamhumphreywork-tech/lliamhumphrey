"use client"

import { useEffect, useState } from "react"
import { X, Share } from "lucide-react"

export function InstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only show on iOS Safari when not already installed
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    const dismissed = (() => { try { return localStorage.getItem("pvc-install-dismissed") === "1" } catch { return false } })()
    if (isIOS && !isStandalone && !dismissed) {
      // Slight delay so it doesn't flash on load
      setTimeout(() => setShow(true), 2000)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem("pvc-install-dismissed", "1") } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(70px + env(safe-area-inset-bottom, 0px))",
        left: 16,
        right: 16,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
        zIndex: 9999,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          Add PVC to your home screen
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Tap <Share size={13} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} /> then &ldquo;Add to Home Screen&rdquo; for the full app experience and push notifications.
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: "none",
          border: "none",
          padding: 4,
          cursor: "pointer",
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
