import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { sendPushToAll } from "@/lib/push"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const events = await db.event.findMany({
    orderBy: { startDate: "asc" },
    include: {
      rsvps: { include: { user: true } },
      _count: { select: { rsvps: true } },
    },
  })

  return NextResponse.json(events)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const data = await req.json()
  const event = await db.event.create({
    data: {
      title: data.title,
      description: data.description || null,
      eventType: data.eventType ?? "event",
      location: data.location || null,
      isOnline: data.isOnline ?? false,
      meetingUrl: data.meetingUrl || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      coverImage: data.coverImage || null,
    },
  })

  // Notify all members except the creator
  const members = await db.user.findMany({
    where: { id: { not: session!.user!.id! } },
    select: { id: true },
  })
  if (members.length > 0) {
    const actor = await db.user.findUnique({ where: { id: session!.user!.id! }, select: { name: true } })
    await db.notification.createMany({
      data: members.map((m) => ({
        userId: m.id,
        actorId: session!.user!.id!,
        type: "event",
        message: `${actor?.name ?? "Admin"} posted a new event: ${event.title}`,
      })),
    })
  }

  sendPushToAll(
    { title: "New event", body: event.title, url: `/events#event-${event.id}` },
    session!.user!.id!
  ).catch(() => {})

  return NextResponse.json(event, { status: 201 })
}
