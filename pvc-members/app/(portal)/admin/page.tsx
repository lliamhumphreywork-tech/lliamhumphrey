import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { AdminClient } from "./AdminClient"

export const metadata = { title: "Admin — PVC Members" }

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  // Always verify role from DB — JWT token may be stale if role was changed after sign-in
  const dbUser = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (dbUser?.role !== "ADMIN") redirect("/feed")

  const [members, events, onboarding] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { posts: true } } },
    }),
    db.event.findMany({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { rsvps: true } } },
    }),
    db.onboardingResponse.findMany({
      orderBy: { submittedAt: "desc" },
    }),
  ])

  return <AdminClient members={members as any} events={events as any} onboarding={onboarding} />
}
