export const metadata = { title: "Check your email — PVC Members" }

export default function VerifyPage() {
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
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--accent-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 28px",
            fontSize: 28,
            color: "var(--accent)",
          }}
        >
          ✉
        </div>
        <h1
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          Check your inbox
        </h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 32 }}>
          A sign-in link is on its way. Click it to access your account.
          <br />
          The link expires in 24 hours.
        </p>
        <a
          href="/login"
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textDecoration: "underline",
            textDecorationColor: "var(--border)",
          }}
        >
          Back to login
        </a>
      </div>
    </div>
  )
}
