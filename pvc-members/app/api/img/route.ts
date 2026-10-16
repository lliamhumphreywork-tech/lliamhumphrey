import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 401 })

  const { searchParams } = new URL(req.url)
  const blobUrl = searchParams.get("url")
  if (!blobUrl || !blobUrl.includes("blob.vercel-storage.com")) {
    return new NextResponse(null, { status: 400 })
  }

  const res = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  })
  if (!res.ok) return new NextResponse(null, { status: res.status })

  const contentType = res.headers.get("content-type") ?? "image/jpeg"
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  })
}
