import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { PostComposer } from "@/components/feed/PostComposer"
import { PostCard } from "@/components/feed/PostCard"
import { SpaceHeader } from "@/components/spaces/SpaceHeader"

export default async function SpacePage({ params }: { params: { slug: string } }) {
  const [session, space] = await Promise.all([
    auth(),
    db.space.findUnique({
      where: { slug: params.slug },
      include: {
        posts: {
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
        },
        _count: { select: { posts: true, members: true } },
      },
    }),
  ])

  if (!space) notFound()

  const userId = (session?.user?.id) ?? ""
  const role = (session!.user as any).role

  return (
    <div>
      <SpaceHeader space={space as any} isAdmin={role === "ADMIN"} />

      <div className="page-container" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px" }}>
        <PostComposer spaceId={space.id} placeholder={`Post in ${space.name}...`} />

        {space.posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
            Nothing here yet. Start the conversation.
          </div>
        ) : (
          space.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as any}
              currentUserId={userId}
              currentUserRole={role}
            />
          ))
        )}
      </div>
    </div>
  )
}
