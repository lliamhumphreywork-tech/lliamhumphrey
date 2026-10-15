import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ members: [], posts: [], spaces: [] })

  const [members, posts, spaces] = await Promise.all([
    db.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { bio: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true, avatar: true, role: true, bio: true },
      take: 5,
    }),
    db.post.findMany({
      where: { content: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatar: true } },
        space: { select: { slug: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.space.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, slug: true, name: true, emoji: true, description: true },
      take: 5,
    }),
  ])

  return NextResponse.json({ members, posts, spaces })
}
