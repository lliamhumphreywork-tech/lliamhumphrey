import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const data = await req.json()
  const update: Record<string, unknown> = {}
  if (data.title !== undefined)       update.title       = data.title
  if (data.description !== undefined) update.description = data.description || null
  if (data.location !== undefined)    update.location    = data.location || null
  if (data.isOnline !== undefined)    update.isOnline    = data.isOnline
  if (data.meetingUrl !== undefined)  update.meetingUrl  = data.meetingUrl || null
  if (data.startDate !== undefined)   update.startDate   = new Date(data.startDate)
  if (data.endDate !== undefined)     update.endDate     = data.endDate ? new Date(data.endDate) : null
  if (data.coverImage !== undefined)  update.coverImage  = data.coverImage || null
  const event = await db.event.update({ where: { id: params.id }, data: update })
  return NextResponse.json(event)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await db.event.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
