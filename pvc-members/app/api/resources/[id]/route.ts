import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

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
