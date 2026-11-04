"use client"

import { useState } from "react"
import { X } from "lucide-react"

export function IntroNudge({ name }: { name: string | null }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const firstName = name?.split(" ")[0] ?? "there"

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(200,255,0,0.06) 0%, rgba(200,255,0,0.02) 100%)",
      border: "1px solid rgba(200,255,0,0.2)",
      borderRadius: "var(--radius-lg)",
      padding: "18px 20px",
      marginBottom: 16,
      position: "relative",
    }}>
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute", top: 12, right: 12,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-muted)", padding: 4, display: "flex",
        }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>
        Welcome, {firstName}. Introduce yourself.
      </p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
        The room doesn&apos;t know you yet. Post a quick intro — who you are, what you&apos;re building, and what you&apos;re looking for. That&apos;s how conversations start.
      </p>
      <button
        onClick={() => {
          setDismissed(true)
          // Open the post composer by clicking its collapsed trigger
          const trigger = document.querySelector<HTMLElement>("[data-composer-trigger]")
          trigger?.click()
        }}
        style={{
          padding: "8px 18px",
          background: "var(--accent)",
          color: "#000",
          border: "none",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Write your intro
      </button>
    </div>
  )
}
