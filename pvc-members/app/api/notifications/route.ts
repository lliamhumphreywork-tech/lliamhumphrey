import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notifications = await db.notification.findMany({
    where: { userId: session!.user!.id },
    include: { actor: { select: { id: true, name: true, avatar: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(notifications)
}

export async function PATCH() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db.notification.updateMany({
    where: { userId: session!.user!.id, read: false },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
