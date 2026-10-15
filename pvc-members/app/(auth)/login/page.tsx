import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginForm } from "@/components/auth/LoginForm"

export const metadata = { title: "Sign in — PVC Members" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const session = await auth()
  if (session) redirect("/feed")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <img
            src="/logo-horizontal.webp"
            alt="Private Victories"
            style={{ width: "100%", maxWidth: 440, height: "auto", display: "inline-block", opacity: 1 }}
          />
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 500, fontSize: 9, letterSpacing: "0.4em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14 }}>
            Members Portal
          </div>
        </div>

        {/* Form */}
        {searchParams.error && (
          <p style={{ color: "#e55", fontSize: 13, marginBottom: 16, padding: "10px 12px", background: "rgba(229,85,85,0.08)", border: "1px solid rgba(229,85,85,0.2)", borderRadius: 4 }}>
            Auth error: {searchParams.error}
          </p>
        )}
        <LoginForm />

        <p style={{ textAlign: "center", marginTop: 32, fontSize: 11, letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          Access by invitation only.
        </p>
      </div>
    </div>
  )
}
