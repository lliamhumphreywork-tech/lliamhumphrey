import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const members = await db.user.findMany({
    orderBy: [{ isOnline: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { posts: true } } },
  })

  return NextResponse.json(members)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId, role: newRole } = await req.json()
  const updated = await db.user.update({
    where: { id: userId },
    data: { role: newRole },
  })

  return NextResponse.json(updated)
}
