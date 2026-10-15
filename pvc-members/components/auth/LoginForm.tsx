"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError("")

    try {
      const result = await signIn("nodemailer", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/feed",
      })

      if (result?.error) {
        setError("Something went wrong. Try again.")
      } else {
        setSent(true)
      }
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center fade-in">
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--accent-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 24,
          }}
        >
          ✓
        </div>
        <h2
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Check your inbox
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.7 }}>
          We sent a sign-in link to{" "}
          <span style={{ color: "var(--text-primary)" }}>{email}</span>.
          <br />
          Click it to access your account.
        </p>
        <button
          onClick={() => setSent(false)}
          style={{
            marginTop: 24,
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationColor: "var(--border)",
          }}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 10,
          }}
        >
          Email address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@privatevictoriesclub.com"
          required
          autoFocus
          style={{
            width: "100%",
            padding: "12px 0",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontSize: 15,
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderBottomColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderBottomColor = "var(--border)")}
        />
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !email.trim()}
        style={{
          width: "100%",
          marginTop: 32,
          padding: "13px",
          background: loading || !email.trim() ? "transparent" : "var(--accent)",
          color: loading || !email.trim() ? "var(--text-muted)" : "#060d18",
          border: `1px solid ${loading || !email.trim() ? "var(--border)" : "var(--accent)"}`,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: "Syne, sans-serif",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          transition: "all 0.15s",
          cursor: loading || !email.trim() ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Sending..." : "Continue"}
      </button>
    </form>
  )
}
