import { NextResponse } from "next/server"
import { db as prisma } from "@/lib/db"

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (token !== process.env.MEMBERS_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, name } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const normalised = email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, email: true },
  })

  if (existing) {
    if (name) {
      await prisma.user.update({ where: { id: existing.id }, data: { name } })
    }
    return NextResponse.json({ id: existing.id, email: existing.email, created: false })
  }

  const user = await prisma.user.create({
    data: { email: normalised, name: name || null, role: "GA" },
  })

  return NextResponse.json({ id: user.id, email: user.email, created: true })
}
