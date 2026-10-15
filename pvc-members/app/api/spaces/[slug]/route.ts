import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const space = await db.space.findUnique({ where: { slug: params.slug } })
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(space)
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({ where: { id: session!.user!.id }, select: { role: true } })
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, description, emoji, coverImage, accentColor } = body

  const space = await db.space.update({
    where: { slug: params.slug },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(emoji !== undefined && { emoji }),
      ...(coverImage !== undefined && { coverImage }),
      ...(accentColor !== undefined && { accentColor }),
    },
  })

  return NextResponse.json(space)
}
