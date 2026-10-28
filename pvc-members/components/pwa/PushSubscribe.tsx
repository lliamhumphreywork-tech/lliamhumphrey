"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)))
}

export function PushSubscribe({ iconOnly }: { iconOnly?: boolean } = {}) {
  const [state, setState] = useState<"loading" | "unsupported" | "subscribed" | "unsubscribed">("loading")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? "subscribed" : "unsubscribed")
    }).catch(() => setState("unsupported"))
  }, [])

  async function subscribe() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      setState("subscribed")
    } catch {
      // User denied or error
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState("unsubscribed")
    } catch {
      //
    } finally {
      setBusy(false)
    }
  }

  if (state === "loading" || state === "unsupported") return null

  if (iconOnly) {
    return (
      <button
        onClick={state === "subscribed" ? unsubscribe : subscribe}
        disabled={busy}
        title={state === "subscribed" ? "Push notifications on" : "Enable push notifications"}
        style={{
          background: "none",
          border: "none",
          padding: 4,
          borderRadius: "var(--radius-sm)",
          display: "flex",
          cursor: busy ? "not-allowed" : "pointer",
          color: state === "subscribed" ? "var(--accent)" : "var(--text-muted)",
          opacity: busy ? 0.5 : 1,
          transition: "color 0.15s",
        }}
      >
        {state === "subscribed" ? <Bell size={15} /> : <BellOff size={15} />}
      </button>
    )
  }

  return (
    <button
      onClick={state === "subscribed" ? unsubscribe : subscribe}
      disabled={busy}
      title={state === "subscribed" ? "Turn off notifications" : "Turn on notifications"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: state === "subscribed" ? "var(--accent-dim)" : "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        color: state === "subscribed" ? "var(--accent)" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 500,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "all 0.15s",
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}
    >
      {state === "subscribed"
        ? <><BellOff size={14} /> Notifications on</>
        : <><Bell size={14} /> Get notified</>
      }
    </button>
  )
}
