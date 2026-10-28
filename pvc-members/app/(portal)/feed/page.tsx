import { auth } from "@/auth"
import { db } from "@/lib/db"
import { PostComposer } from "@/components/feed/PostComposer"
import { FeedClient } from "@/components/feed/FeedClient"

export const metadata = { title: "Feed — PVC Members" }

export default async function FeedPage() {
  const session = await auth()
  const userId = (session?.user?.id) ?? ""
  const role = (session!.user as any).role

  const [currentUser, posts] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { avatar: true } }),
    db.post.findMany({
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        space: { select: { id: true, name: true, slug: true } },
        comments: {
          include: { author: { select: { id: true, name: true, email: true, avatar: true, role: true } } },
          orderBy: { createdAt: "asc" },
          take: 10,
        },
        reactions: { select: { emoji: true, userId: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
  ])

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
      <FeedClient initialPosts={posts as any} currentUserId={userId} currentUserRole={role} />
      </div>
    </div>
  )
}
