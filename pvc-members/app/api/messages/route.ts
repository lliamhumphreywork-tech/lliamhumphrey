import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { sendPushToUser } from "@/lib/push"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const partnerId = searchParams.get("with")

  const messages = await db.message.findMany({
    where: partnerId
      ? {
          OR: [
            { senderId: session!.user!.id!, receiverId: partnerId },
            { senderId: partnerId, receiverId: session!.user!.id! },
          ],
        }
      : {
          OR: [{ senderId: session!.user!.id! }, { receiverId: session!.user!.id! }],
        },
    orderBy: { createdAt: "asc" },
    include: { sender: true, receiver: true },
  })

  return NextResponse.json(messages)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { receiverId, content } = await req.json()
  if (!receiverId || !content?.trim()) {
    return NextResponse.json({ error: "receiverId and content required" }, { status: 400 })
  }

  const message = await db.message.create({
    data: {
      content: content.trim(),
      senderId: session!.user!.id!,
      receiverId,
    },
    include: { sender: true, receiver: true },
  })

  const senderName = message.sender.name || "Someone"
  const preview = content.trim().slice(0, 80)
  sendPushToUser(receiverId, {
    title: `${senderName}`,
    body: preview,
    url: `/messages?with=${session!.user!.id!}`,
  }).catch(() => {})

  return NextResponse.json(message, { status: 201 })
}
