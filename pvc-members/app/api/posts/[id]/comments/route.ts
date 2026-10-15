import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { notifyMentions } from "@/lib/notifications"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const [comment, post] = await Promise.all([
    db.comment.create({
      data: { content: content.trim(), authorId: session!.user!.id, postId: params.id },
      include: { author: true },
    }),
    db.post.findUnique({ where: { id: params.id }, select: { authorId: true } }),
  ])

  // Notify post author (not self)
  if (post && post.authorId !== session!.user!.id) {
    await db.notification.create({
      data: {
        userId: post.authorId,
        actorId: session!.user!.id,
        type: "comment",
        postId: params.id,
        message: `${comment.author.name ?? "Someone"} commented on your post`,
      },
    })
  }

  await notifyMentions(content.trim(), session!.user!.id!, params.id, post ? [post.authorId] : [])

  return NextResponse.json(comment, { status: 201 })
}
