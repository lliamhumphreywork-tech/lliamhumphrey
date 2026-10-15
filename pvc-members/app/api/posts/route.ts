import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { notifyMentions } from "@/lib/notifications"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const posts = await db.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      author: true,
      space: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      reactions: { include: { user: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  })

  return NextResponse.json(posts)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content, spaceId, attachments } = await req.json()
  const hasContent = content?.trim()
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  if (!hasContent && !hasAttachments) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const post = await db.post.create({
    data: {
      content: hasContent ? content.trim() : "",
      authorId: session!.user!.id!,
      spaceId: spaceId ?? null,
      attachments: hasAttachments ? attachments : [],
    },
  })

  if (hasContent) {
    await notifyMentions(content.trim(), session!.user!.id!, post.id)
  }

  return NextResponse.json(post, { status: 201 })
}
