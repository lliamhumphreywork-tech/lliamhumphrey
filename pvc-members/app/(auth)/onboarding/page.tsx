import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { OnboardingFlow } from "./OnboardingFlow"

export const metadata = { title: "Welcome — PVC Members" }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session!.user!.id } })
  if (!user) redirect("/login")
  if (user.name) redirect("/feed")

  return <OnboardingFlow email={user.email ?? ""} />
}
