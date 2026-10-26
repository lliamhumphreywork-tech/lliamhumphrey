import { auth } from "@/auth"
import { db } from "@/lib/db"
import { PostComposer } from "@/components/feed/PostComposer"
import { PostCard } from "@/components/feed/PostCard"

export const metadata = { title: "Feed — PVC Members" }

export default async function FeedPage() {
  const session = await auth()
  const userId = (session?.user?.id) ?? ""
  const role = (session!.user as any).role

  const currentUser = await db.user.findUnique({ where: { id: userId }, select: { avatar: true } })

  const posts = await db.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      author: true,
      space: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
      reactions: { include: { user: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  })

  return (
    <div>
      {/* Feed header — full width, flush like Circle */}
      <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
        <div className="page-container" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Feed
            </h1>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, paddingBottom: 12, borderBottom: "2px solid var(--accent)" }}>
              All posts
            </div>
          </div>
        </div>
      </div>

      <div className="page-container" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px" }}>
      <PostComposer composerAvatar={currentUser?.avatar} />

      {posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: 15 }}>
          Nothing posted yet. Be the first.
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post as any} currentUserId={userId} currentUserRole={role} />
        ))
      )}
      </div>
    </div>
  )
}
