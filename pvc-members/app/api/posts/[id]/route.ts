import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const post = await db.post.findUnique({ where: { id: params.id } })
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const role = (session.user as any).role
  if (post.authorId !== session!.user!.id && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const updated = await db.post.update({
    where: { id: params.id },
    data: { content: content.trim() },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const post = await db.post.findUnique({ where: { id: params.id } })
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const role = (session.user as any).role
  if (post.authorId !== session!.user!.id && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.post.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
