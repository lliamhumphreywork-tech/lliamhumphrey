import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "@/components/auth/SessionProvider"
import { AutoUpdater } from "@/components/AutoUpdater"
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration"
import { InstallBanner } from "@/components/pwa/InstallBanner"

export const metadata: Metadata = {
  title: {
    default: "Private Victories — Members",
    template: "%s — PVC Members",
  },
  description: "Private Victories Club — Africa's private network for founders scaling businesses.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PVC",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <AutoUpdater />
          <ServiceWorkerRegistration />
          {children}
          <InstallBanner />
        </SessionProvider>
      </body>
    </html>
  )
}
