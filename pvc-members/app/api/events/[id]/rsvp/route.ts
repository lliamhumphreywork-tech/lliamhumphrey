import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [rsvp, event, actor] = await Promise.all([
    db.eventRSVP.upsert({
      where: { userId_eventId: { userId: session!.user!.id!, eventId: params.id } },
      create: { userId: session!.user!.id!, eventId: params.id },
      update: {},
    }),
    db.event.findUnique({ where: { id: params.id }, select: { title: true } }),
    db.user.findUnique({ where: { id: session!.user!.id! }, select: { name: true } }),
  ])

  // Notify all admins about the RSVP
  const admins = await db.user.findMany({
    where: { role: "ADMIN", id: { not: session!.user!.id! } },
    select: { id: true },
  })
  if (admins.length > 0 && event) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        actorId: session!.user!.id!,
        type: "event",
        message: `${actor?.name ?? "Someone"} RSVPed to ${event.title}`,
      })),
    })
  }

  return NextResponse.json(rsvp, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db.eventRSVP.deleteMany({
    where: { userId: session!.user!.id!, eventId: params.id },
  })

  return NextResponse.json({ success: true })
}
