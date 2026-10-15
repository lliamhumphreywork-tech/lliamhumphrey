import { db } from "@/lib/db"

export async function notifyMentions(
  content: string,
  actorId: string,
  postId: string,
  excludeUserIds: string[] = [],
) {
  const mentionRegex = /@([a-zA-Z0-9_\- ]+)/g
  const names: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    names.push(match[1].trim().toLowerCase())
  }
  if (names.length === 0) return

  const users = await db.user.findMany({
    where: {
      name: { in: names.map((n) => n), mode: "insensitive" },
      id: { notIn: [actorId, ...excludeUserIds] },
    },
    select: { id: true },
  })
  if (users.length === 0) return

  const actor = await db.user.findUnique({ where: { id: actorId }, select: { name: true } })

  await db.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      actorId,
      type: "mention",
      postId,
      message: `${actor?.name ?? "Someone"} mentioned you`,
    })),
    skipDuplicates: true,
  })
}
