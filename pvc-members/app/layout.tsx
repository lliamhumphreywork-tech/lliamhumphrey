import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "@/components/auth/SessionProvider"

export const metadata: Metadata = {
  title: {
    default: "Private Victories — Members",
    template: "%s — PVC Members",
  },
  description: "Private Victories Club — Africa's private network for founders scaling businesses.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
