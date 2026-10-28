"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { PostCard } from "./PostCard"
import { ArrowUp } from "lucide-react"

type Post = any

type Props = {
  initialPosts: Post[]
  currentUserId: string
  currentUserRole: string
}

export function FeedClient({ initialPosts, currentUserId, currentUserRole }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [newPosts, setNewPosts] = useState<Post[]>([])
  const latestTsRef = useRef(
    initialPosts.length > 0
      ? Math.max(...initialPosts.map((p) => new Date(p.createdAt).getTime()))
      : 0
  )

  // Sync when server re-renders after router.refresh() (e.g. after posting)
  useEffect(() => {
    setPosts(initialPosts)
    setNewPosts([])
    if (initialPosts.length > 0) {
      latestTsRef.current = Math.max(...initialPosts.map((p) => new Date(p.createdAt).getTime()))
    }
  }, [initialPosts[0]?.id])

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/posts", { cache: "no-store" })
      if (!res.ok) return
      const fresh: Post[] = await res.json()

      // Find posts newer than what we're showing
      const knownTs = latestTsRef.current
      const incoming = fresh.filter(
        (p) => new Date(p.createdAt).getTime() > knownTs && p.authorId !== currentUserId
      )
      if (incoming.length > 0) setNewPosts(incoming)
    } catch {}
  }, [currentUserId])

  useEffect(() => {
    const interval = setInterval(poll, 30_000)
    return () => clearInterval(interval)
  }, [poll])

  function loadNewPosts() {
    setPosts((prev) => [...newPosts, ...prev])
    if (newPosts.length > 0) {
      latestTsRef.current = Math.max(
        ...newPosts.map((p) => new Date(p.createdAt).getTime()),
        latestTsRef.current
      )
    }
    setNewPosts([])
  }

  return (
    <div style={{ position: "relative" }}>
      {newPosts.length > 0 && (
        <div style={{ position: "sticky", top: 12, zIndex: 10, display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <button
            onClick={loadNewPosts}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              background: "var(--text-primary)",
              color: "var(--bg-base)",
              border: "none",
              borderRadius: "var(--radius-full)",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "Plus Jakarta Sans, sans-serif",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              animation: "pill-drop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <ArrowUp size={14} />
            {newPosts.length} new post{newPosts.length !== 1 ? "s" : ""}
          </button>
          <style>{`
            @keyframes pill-drop {
              from { transform: translateY(-8px); opacity: 0; }
              to   { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: 15 }}>
          Nothing posted yet. Be the first.
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        ))
      )}
    </div>
  )
}
