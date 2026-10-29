import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "@/components/auth/SessionProvider"
import { AutoUpdater } from "@/components/AutoUpdater"
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration"
import { InstallBanner } from "@/components/pwa/InstallBanner"
import { SplashScreen } from "@/components/pwa/SplashScreen"

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
        {/* Splash: in static HTML so it shows before JS loads */}
        <div
          id="pvc-splash"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#111111",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img src="/logo-stacked.webp" alt="Private Victories" style={{ width: 80, height: "auto" }} />
          <style>{`
            @keyframes pvc-pulse { 0%,100%{opacity:.3;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
            #pvc-splash-dot { width:5px;height:5px;border-radius:50%;background:#555;margin-top:32px;animation:pvc-pulse 1.4s ease-in-out infinite; }
          `}</style>
          <div id="pvc-splash-dot" />
        </div>

        <SessionProvider>
          <SplashScreen />
          <AutoUpdater />
          <ServiceWorkerRegistration />
          {children}
          <InstallBanner />
        </SessionProvider>
      </body>
    </html>
  )
}
