import { NextResponse } from "next/server"
import { db as prisma } from "@/lib/db"

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (token !== process.env.MEMBERS_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, name } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: { name: name || undefined },
    create: {
      email: email.toLowerCase().trim(),
      name: name || null,
      role: "GA",
    },
  })

  return NextResponse.json({ id: user.id, email: user.email, created: true })
}
