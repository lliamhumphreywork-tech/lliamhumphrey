import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
  }

  try {
    const blob = await put(`avatars/${session.user?.id ?? "unknown"}-${Date.now()}.jpg`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("Avatar upload error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
