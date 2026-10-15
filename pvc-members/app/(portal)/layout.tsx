import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { Sidebar } from "@/components/layout/Sidebar"
import { RightRail } from "@/components/layout/RightRail"
import { MobileNav } from "@/components/layout/MobileNav"
import { CommandPalette } from "@/components/search/CommandPalette"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session!.user!.id } })
  if (!user) redirect("/login")
  if (!user.name) redirect("/onboarding")

  return (
    <div className="portal-layout" style={{ height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <main
        style={{
          overflowY: "auto",
          background: "var(--bg-base)",
          paddingBottom: 80,
          minHeight: 0,
        }}
      >
        {children}
      </main>
      <RightRail />
      <MobileNav />
      <CommandPalette />
    </div>
  )
}
