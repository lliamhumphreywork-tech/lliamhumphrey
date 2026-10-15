import { auth } from "@/auth"
import { db } from "@/lib/db"
import { MessagesClient } from "./MessagesClient"

export const metadata = { title: "Messages — PVC Members" }

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { with?: string }
}) {
  const session = await auth()
  const userId = (session?.user?.id) ?? ""

  const [allMessages, members] = await Promise.all([
    db.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "asc" },
      include: { sender: true, receiver: true },
    }),
    db.user.findMany({
      where: { id: { not: userId } },
      orderBy: { name: "asc" },
    }),
  ])

  const partnerIds = Array.from(
    new Set(
      allMessages.map((m) =>
        m.senderId === userId ? m.receiverId : m.senderId
      )
    )
  )

  const conversations = partnerIds.map((partnerId) => {
    const msgs = allMessages.filter(
      (m) =>
        (m.senderId === userId && m.receiverId === partnerId) ||
        (m.senderId === partnerId && m.receiverId === userId)
    )
    const partner = members.find((m) => m.id === partnerId)!
    const lastMessage = msgs[msgs.length - 1]
    const unreadCount = msgs.filter((m) => m.receiverId === userId && !m.read).length
    return { partner, lastMessage, unreadCount, messages: msgs }
  })

  const activePartnerId = searchParams.with
  const activePartner = activePartnerId
    ? members.find((m) => m.id === activePartnerId)
    : conversations[0]?.partner

  const activeMessages = activePartner
    ? allMessages.filter(
        (m) =>
          (m.senderId === userId && m.receiverId === activePartner.id) ||
          (m.senderId === activePartner.id && m.receiverId === userId)
      )
    : []

  return (
    <MessagesClient
      userId={userId}
      conversations={conversations as any}
      members={members}
      activePartner={activePartner ?? null}
      activeMessages={activeMessages as any}
    />
  )
}
