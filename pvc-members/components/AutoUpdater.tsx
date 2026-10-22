"use client"

import { useEffect, useRef } from "react"

export function AutoUpdater() {
  const buildId = useRef<string | null>(null)

  useEffect(() => {
    async function fetchBuildId(): Promise<string | null> {
      try {
        const res = await fetch("/_next/static/chunks/webpack.js", { method: "HEAD", cache: "no-store" })
        return res.headers.get("etag") ?? res.headers.get("last-modified")
      } catch {
        return null
      }
    }

    async function checkForUpdate() {
      const current = await fetchBuildId()
      if (!current) return
      if (buildId.current === null) {
        buildId.current = current
        return
      }
      if (buildId.current !== current) {
        window.location.reload()
      }
    }

    // snapshot current build on mount
    fetchBuildId().then((id) => { buildId.current = id })

    // check when user comes back to the tab
    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate()
    }
    document.addEventListener("visibilitychange", onVisible)

    // also check every 5 minutes in the background
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(interval)
    }
  }, [])

  return null
}
