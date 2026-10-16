import { NextResponse } from "next/server"
import { auth } from "@/auth"

export const maxDuration = 300

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

  const contentType = res.headers.get("content-type") ?? "application/octet-stream"
  const name = searchParams.get("name") ?? "file"
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "private, max-age=3600",
  }
  const cl = res.headers.get("content-length")
  if (cl) headers["Content-Length"] = cl

  return new NextResponse(res.body, { headers })
}
