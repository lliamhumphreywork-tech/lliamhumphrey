"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { CheckCircle, Circle, X, ChevronRight, Sparkles } from "lucide-react"

type Step = {
  id: string
  label: string
  description: string
  href: string
  required: boolean
  done: boolean
}

type Props = {
  hasAvatar: boolean
  hasBio: boolean
  hasLocation: boolean
  hasPosted: boolean
}

export function OnboardingModal({ hasAvatar, hasBio, hasLocation, hasPosted }: Props) {
  const router = useRouter()
  const [minimised, setMinimised] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isComplete = hasAvatar && hasBio && hasLocation

  const steps: Step[] = [
    {
      id: "photo",
      label: "Add a profile photo",
      description: "Put a face to your name",
      href: "/profile",
      required: true,
      done: hasAvatar,
    },
    {
      id: "bio",
      label: "Write your bio",
      description: "Tell the club who you are",
      href: "/profile",
      required: true,
      done: hasBio,
    },
    {
      id: "location",
      label: "Add your location",
      description: "Connect with members near you",
      href: "/profile",
      required: true,
      done: hasLocation,
    },
    {
      id: "post",
      label: "Make your first post in the feed",
      description: "Share a win or an update",
      href: "/feed",
      required: false,
      done: hasPosted,
    },
  ]

  const requiredDone = steps.filter((s) => s.required && s.done).length
  const requiredTotal = steps.filter((s) => s.required).length
  const progress = Math.round((requiredDone / requiredTotal) * 100)

  useEffect(() => {
    setMounted(true)
    // Check if dismissed this session
    try {
      const val = sessionStorage.getItem("pvc_onboarding_minimised")
      if (val === "1") setMinimised(true)
    } catch {}
  }, [])

  useEffect(() => {
    if (isComplete) setDismissed(true)
  }, [isComplete])

  function handleMinimise() {
    setMinimised(true)
    try { sessionStorage.setItem("pvc_onboarding_minimised", "1") } catch {}
  }

  function handleExpand() {
    setMinimised(false)
    try { sessionStorage.removeItem("pvc_onboarding_minimised") } catch {}
  }

  if (!mounted || dismissed) return null

  const pill = (
    <button
      onClick={handleExpand}
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-full)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        cursor: "pointer",
        color: "var(--text-primary)",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "Plus Jakarta Sans, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      <Sparkles size={14} style={{ color: "var(--accent)" }} />
      Complete your profile · {requiredDone}/{requiredTotal}
      <span style={{
        width: 48,
        height: 4,
        borderRadius: 2,
        background: "var(--bg-hover)",
        overflow: "hidden",
        display: "inline-block",
      }}>
        <span style={{
          display: "block",
          height: "100%",
          width: `${progress}%`,
          background: "var(--accent)",
          borderRadius: 2,
          transition: "width 0.3s",
        }} />
      </span>
    </button>
  )

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleMinimise() }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "24px 24px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Sparkles size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              Welcome to Private Victories
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Set up your profile so members know who you are.
          </p>

          {/* Progress bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Profile complete
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                {requiredDone}/{requiredTotal}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "var(--bg-hover)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--accent)",
                borderRadius: 2,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>

          <button
            onClick={handleMinimise}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div style={{ padding: "8px 0" }}>
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => router.push(step.href)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 24px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)" }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none" }}
            >
              {step.done ? (
                <CheckCircle size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
              ) : (
                <Circle size={20} style={{ color: step.required ? "var(--border-strong)" : "var(--border)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: step.done ? "var(--text-muted)" : "var(--text-primary)",
                  textDecoration: step.done ? "line-through" : "none",
                  marginBottom: 1,
                }}>
                  {step.label}
                  {!step.required && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-muted)", fontWeight: 400, textDecoration: "none" }}>
                      optional
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{step.description}</div>
              </div>
              {!step.done && <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px 20px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "center",
        }}>
          <button
            onClick={handleMinimise}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(minimised ? pill : modal, document.body)
}
