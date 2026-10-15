"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Check, Loader2, RefreshCw } from "lucide-react"

interface Applicant {
  id: string
  name: string
  email: string
  phone: string
  location: string
  role: string
  experience: string
  hours: string
  proof: string
  timestamp: string
  imported: boolean
}

export default function TalentImportPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string[]>([])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/talent-import")
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Failed to load")
        return
      }
      const data = await res.json()
      setApplicants(data)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function importSelected() {
    const toImport = applicants.filter(a => selected.has(a.id) && !a.imported)
    if (!toImport.length) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/talent-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicants: toImport }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      setSaved(prev => [...prev, ...toImport.map(a => a.id)])
      setSelected(new Set())
      await load()
    } catch {
      setError("Failed to import")
    } finally {
      setSaving(false)
    }
  }

  const unimported = applicants.filter(a => !a.imported)
  const selectedCount = Array.from(selected).filter(id => !applicants.find(a => a.id === id)?.imported).length

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Talent Import
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Applicants from your Google Forms sales roles intake. Select who to add to the talent network.
        </p>
      </div>

      {/* Actions bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button
          onClick={importSelected}
          disabled={selectedCount === 0 || saving}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: "var(--radius)",
            background: selectedCount > 0 ? "var(--accent)" : "var(--bg-elevated)",
            color: selectedCount > 0 ? "#fff" : "var(--text-muted)",
            border: "none", fontSize: 13, fontWeight: 600,
            cursor: selectedCount > 0 ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Check size={14} />}
          {saving ? "Importing…" : `Add ${selectedCount > 0 ? selectedCount : ""} to talent network`.trim()}
        </button>
        <button
          onClick={load}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "8px 12px", borderRadius: "var(--radius)",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
          }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
          {applicants.length} applicant{applicants.length !== 1 ? "s" : ""} · {applicants.filter(a => a.imported).length} already imported
        </span>
      </div>

      {error && (
        <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>
          <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: 10 }} />
          <div>Loading applicants from Google Sheet…</div>
        </div>
      ) : applicants.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>
          No applicants found in the sheet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {applicants.map(a => {
            const isSelected = selected.has(a.id)
            return (
              <div
                key={a.id}
                onClick={() => !a.imported && toggle(a.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  gap: 14,
                  alignItems: "flex-start",
                  padding: "14px 16px",
                  background: isSelected ? "var(--accent-dim)" : "var(--bg-elevated)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-lg)",
                  cursor: a.imported ? "default" : "pointer",
                  transition: "border-color 0.1s, background 0.1s",
                  opacity: a.imported ? 0.5 : 1,
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `2px solid ${isSelected ? "var(--accent)" : "var(--border-strong)"}`,
                  background: isSelected ? "var(--accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 2,
                }}>
                  {isSelected && <Check size={11} color="#fff" />}
                </div>

                {/* Info */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 7px",
                      borderRadius: 99,
                      background: a.role === "Closer" ? "rgba(34,197,94,0.12)" : a.role === "Both" ? "rgba(75,123,245,0.12)" : "rgba(255,255,255,0.06)",
                      color: a.role === "Closer" ? "#22c55e" : a.role === "Both" ? "var(--accent)" : "var(--text-muted)",
                    }}>
                      {a.role === "Both" ? "Setter + Closer" : a.role || "Unknown"}
                    </span>
                    {a.imported && <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 600 }}>Imported</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                    <span>{a.email}</span>
                    {a.phone && <span>{a.phone}</span>}
                    {a.location && <span>{a.location}</span>}
                    {a.experience && <span>{a.experience} exp.</span>}
                    {a.hours && <span>{a.hours}/day</span>}
                  </div>
                </div>

                {/* Proof link */}
                <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 2 }}>
                  {a.proof && a.proof.startsWith("http") ? (
                    <a
                      href={a.proof}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 11, color: "var(--accent)",
                        padding: "4px 8px", borderRadius: 6,
                        border: "1px solid var(--accent-dim)",
                        background: "var(--accent-dim)",
                        textDecoration: "none", whiteSpace: "nowrap",
                      }}
                    >
                      <ExternalLink size={10} />
                      {a.proof.includes("loom") ? "Loom" : "Video"}
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No video</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
