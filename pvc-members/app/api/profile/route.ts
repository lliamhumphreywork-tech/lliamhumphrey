import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: session!.user!.id! } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await req.json()
  const allowed = ["name", "bio", "location", "website", "twitter", "instagram", "linkedin", "avatar"]
  const update: Record<string, string> = {}

  for (const key of allowed) {
    if (!(key in data)) continue
    // Never allow saving an empty name — would trigger onboarding redirect
    if (key === "name" && !String(data[key]).trim()) continue
    update[key] = data[key]
  }

  const user = await db.user.update({
    where: { id: session!.user!.id! },
    data: update,
  })

  return NextResponse.json(user)
}
