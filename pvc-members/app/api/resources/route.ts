import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const resources = await db.resource.findMany({
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true, avatar: true, role: true } } },
  })
  return NextResponse.json(resources)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { type = "file", title, description, fileUrl, fileName, fileType, fileSize } = body

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })
  if (type === "file" && !fileUrl) return NextResponse.json({ error: "File required" }, { status: 400 })
  if (type === "link" && !fileUrl) return NextResponse.json({ error: "URL required" }, { status: 400 })
  if (type === "text" && !description?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const resource = await db.resource.create({
    data: {
      type,
      title: title.trim(),
      description: description?.trim() ?? null,
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
      fileType: fileType ?? null,
      fileSize: fileSize ?? null,
      uploadedById: session!.user!.id!,
    },
    include: { uploadedBy: { select: { id: true, name: true, avatar: true, role: true } } },
  })
  return NextResponse.json(resource)
}
