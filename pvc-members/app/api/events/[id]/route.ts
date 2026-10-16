import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const data = await req.json()
  const event = await db.event.update({
    where: { id: params.id },
    data: {
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      isOnline: data.isOnline ?? false,
      meetingUrl: data.meetingUrl || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      coverImage: data.coverImage || null,
    },
  })
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
