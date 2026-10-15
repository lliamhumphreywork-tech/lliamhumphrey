import { auth } from "@/auth"
import { db } from "@/lib/db"
import { ProfileForm } from "./ProfileForm"

export const metadata = { title: "Profile — PVC Members" }

export default async function ProfilePage() {
  const session = await auth()
  const user = await db.user.findUnique({ where: { id: (session?.user?.id) ?? "" } })
  if (!user) return null

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Your profile
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 }}>
        How other members see you
      </p>
      <ProfileForm user={user} />
    </div>
  )
}
