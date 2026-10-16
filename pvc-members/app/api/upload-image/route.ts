import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const blob = await put(file.name, file, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  const proxyUrl = `/api/img?url=${encodeURIComponent(blob.url)}`
  return NextResponse.json({ url: proxyUrl })
}
