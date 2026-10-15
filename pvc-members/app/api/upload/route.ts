import { NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody

  if (body.type === "blob.generate-client-token") {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/x-m4v",
          "image/jpeg", "image/png", "image/gif", "image/webp",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/plain", "text/csv",
          "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a",
          "audio/ogg", "audio/webm", "audio/aac", "audio/flac",
          "audio/x-wav", "audio/x-mp3", "audio/mp3",
        ],
        maximumSizeInBytes: 500 * 1024 * 1024,
      }),
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[upload] handleUpload error:", err)
    return NextResponse.json({ error: (err as Error).message ?? String(err) }, { status: 400 })
  }
}
