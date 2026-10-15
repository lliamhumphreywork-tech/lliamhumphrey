"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Users, FileText, Hash, X } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { stripHtml } from "@/lib/utils"
import { getSpaceIcon } from "@/lib/spaceIcons"

type SearchResults = {
  members: Array<{ id: string; name: string | null; email: string; avatar: string | null; role: string; bio: string | null }>
  posts: Array<{ id: string; content: string; createdAt: string; author: { id: string; name: string | null; avatar: string | null }; space: { slug: string; name: string } | null }>
  spaces: Array<{ id: string; slug: string; name: string; emoji: string; description: string | null }>
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>({ members: [], posts: [], spaces: [] })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const totalResults = results.members.length + results.posts.length + results.spaces.length

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery("")
    setResults({ members: [], posts: [], spaces: [] })
    setSelected(0)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        openPalette()
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [openPalette])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (query.length < 2) {
      setResults({ members: [], posts: [], spaces: [] })
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) setResults(await res.json())
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const allItems = [
    ...results.members.map((m) => ({ type: "member" as const, data: m })),
    ...results.posts.map((p) => ({ type: "post" as const, data: p })),
    ...results.spaces.map((s) => ({ type: "space" as const, data: s })),
  ]

  function navigate(item: typeof allItems[number]) {
    setOpen(false)
    if (item.type === "member") router.push(`/members/${item.data.id}`)
    else if (item.type === "post") router.push(`/feed#${item.data.id}`)
    else router.push(`/spaces/${(item.data as any).slug}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, allItems.length - 1)) }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === "Enter" && allItems[selected]) navigate(allItems[selected])
  }

  if (!open) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKeyDown}
            placeholder="Search members, posts, spaces..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: 15,
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          />
          {loading && <div style={{ width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />}
          {!loading && query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
              <X size={14} />
            </button>
          )}
          <kbd style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {query.length < 2 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Type at least 2 characters to search
            </div>
          )}

          {query.length >= 2 && !loading && totalResults === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}

          {results.members.length > 0 && (
            <Section label="Members" icon={<Users size={12} />}>
              {results.members.map((m, i) => {
                const idx = i
                return (
                  <ResultRow key={m.id} selected={selected === idx} onSelect={() => setSelected(idx)} onClick={() => navigate({ type: "member", data: m })}>
                    <Avatar src={m.avatar} name={m.name} size={28} role={m.role as any} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{m.name ?? m.email}</div>
                      {m.bio && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{m.bio.slice(0, 60)}</div>}
                    </div>
                    <RoleBadge role={m.role} />
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {results.posts.length > 0 && (
            <Section label="Posts" icon={<FileText size={12} />}>
              {results.posts.map((p, i) => {
                const idx = results.members.length + i
                const text = stripHtml(p.content)
                return (
                  <ResultRow key={p.id} selected={selected === idx} onSelect={() => setSelected(idx)} onClick={() => navigate({ type: "post", data: p })}>
                    <Avatar src={p.author.avatar} name={p.author.name} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {text.slice(0, 80)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        by {p.author.name ?? "Unknown"}{p.space ? ` · #${p.space.name}` : ""}
                      </div>
                    </div>
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {results.spaces.length > 0 && (
            <Section label="Spaces" icon={<Hash size={12} />}>
              {results.spaces.map((s, i) => {
                const idx = results.members.length + results.posts.length + i
                return (
                  <ResultRow key={s.id} selected={selected === idx} onSelect={() => setSelected(idx)} onClick={() => navigate({ type: "space", data: s })}>
                    {(() => { const SI = getSpaceIcon(s.slug); return <div style={{ width: 28, display: "flex", justifyContent: "center" }}><SI size={16} style={{ color: "var(--accent)", opacity: 0.8 }} /></div> })()}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</div>
                      {s.description && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{s.description.slice(0, 60)}</div>}
                    </div>
                  </ResultRow>
                )
              })}
            </Section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 16, color: "var(--text-muted)", fontSize: 11 }}>
          <span><kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px", fontSize: 10 }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px", fontSize: 10 }}>↵</kbd> open</span>
        </div>
      </div>
    </div>
  )
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px 4px", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {icon} {label}
      </div>
      {children}
    </div>
  )
}

function ResultRow({ selected, onSelect, onClick, children }: { selected: boolean; onSelect: () => void; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onMouseEnter={onSelect}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        cursor: "pointer",
        background: selected ? "var(--bg-hover)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {children}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  if (role === "GA") return null
  return (
    <span style={{
      marginLeft: "auto",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.06em",
      color: role === "ADMIN" ? "var(--text-muted)" : "var(--accent)",
      background: role === "ADMIN" ? "var(--bg-surface)" : "var(--accent-dim)",
      border: `1px solid ${role === "ADMIN" ? "var(--border)" : "var(--accent)"}`,
      borderRadius: 4,
      padding: "1px 5px",
      flexShrink: 0,
    }}>
      {role}
    </span>
  )
}
