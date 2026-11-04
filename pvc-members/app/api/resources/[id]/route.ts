import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const resource = await db.resource.findUnique({ where: { id: params.id } })
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const role = (session.user as any)?.role
  if (resource.uploadedById !== session!.user!.id && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const validCategories = ["recordings", "sops", "other"]
  const updates: Record<string, unknown> = {}
  if (body.category && validCategories.includes(body.category)) updates.category = body.category
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim()

  const updated = await db.resource.update({
    where: { id: params.id },
    data: updates,
    include: { uploadedBy: { select: { id: true, name: true, avatar: true, role: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const resource = await db.resource.findUnique({ where: { id: params.id } })
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const role = (session.user as any)?.role
  if (resource.uploadedById !== session!.user!.id && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.resource.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
