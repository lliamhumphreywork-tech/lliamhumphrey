import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { emoji } = await req.json()
  if (!emoji) return NextResponse.json({ error: "Emoji required" }, { status: 400 })

  const existing = await db.reaction.findUnique({
    where: { userId_postId_emoji: { userId: session!.user!.id, postId: params.id, emoji } },
  })

  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } })
    return NextResponse.json({ removed: true })
  }

  const [reaction, post, actor] = await Promise.all([
    db.reaction.create({ data: { emoji, userId: session!.user!.id, postId: params.id } }),
    db.post.findUnique({ where: { id: params.id }, select: { authorId: true } }),
    db.user.findUnique({ where: { id: session!.user!.id }, select: { name: true } }),
  ])

  // Notify post author (not self)
  if (post && post.authorId !== session!.user!.id) {
    await db.notification.create({
      data: {
        userId: post.authorId,
        actorId: session!.user!.id,
        type: "reaction",
        postId: params.id,
        message: `${actor?.name ?? "Someone"} reacted ${emoji} to your post`,
      },
    })
  }

  return NextResponse.json(reaction, { status: 201 })
}
