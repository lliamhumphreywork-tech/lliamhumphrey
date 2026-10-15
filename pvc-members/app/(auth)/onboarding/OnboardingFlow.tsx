"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

const STEPS = ["Welcome", "About you", "Socials"]

const field: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: 15,
  outline: "none",
  fontFamily: "Plus Jakarta Sans, sans-serif",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "var(--accent)" }}>*</span>}
      </label>
      <input
        type={type}
        style={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        required={required}
      />
    </div>
  )
}

export function OnboardingFlow({ email }: { email: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    name: "",
    avatar: "",
    bio: "",
    location: "",
    twitter: "",
    instagram: "",
    linkedin: "",
    website: "",
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function next(e: React.FormEvent) {
    e.preventDefault()
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else handleFinish()
  }

  function handleFinish() {
    if (!form.name.trim()) { setStep(0); return }
    setError("")
    startTransition(async () => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        router.push("/feed")
        router.refresh()
      } else {
        setError("Something went wrong. Please try again.")
      }
    })
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>
            Private Victories Club
          </p>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8 }}>
            {step === 0 ? "Welcome to the community" : step === 1 ? "Tell us about yourself" : "Connect your socials"}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {step === 0 ? `Setting up your profile, ${email.split("@")[0]}.` : step === 1 ? "Help members get to know you." : "Optional — you can skip this."}
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 99,
                background: i <= step ? "var(--accent)" : "var(--border)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* Card */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32 }}>
          <form onSubmit={next}>

            {step === 0 && (
              <>
                <FieldInput
                  label="Display name"
                  value={form.name}
                  onChange={(v) => set("name", v)}
                  placeholder="Your full name"
                  required
                />
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                    Profile photo URL <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                  </label>
                  <input
                    type="url"
                    style={field}
                    value={form.avatar}
                    onChange={(e) => set("avatar", e.target.value)}
                    placeholder="https://..."
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                  {form.avatar && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      <img
                        src={form.avatar}
                        alt="Preview"
                        style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Preview</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Bio</label>
                  <textarea
                    style={{ ...field, resize: "vertical", minHeight: 100 }}
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder="What are you building? What do you do? What's your story?"
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                </div>
                <FieldInput
                  label="Location"
                  value={form.location}
                  onChange={(v) => set("location", v)}
                  placeholder="Cape Town, South Africa"
                />
                <FieldInput
                  label="Website"
                  value={form.website}
                  onChange={(v) => set("website", v)}
                  placeholder="https://yoursite.com"
                  type="url"
                />
              </>
            )}

            {step === 2 && (
              <>
                <FieldInput label="Twitter / X" value={form.twitter} onChange={(v) => set("twitter", v)} placeholder="username (no @)" />
                <FieldInput label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} placeholder="username (no @)" />
                <FieldInput label="LinkedIn" value={form.linkedin} onChange={(v) => set("linkedin", v)} placeholder="username or profile URL" />
              </>
            )}

            {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  style={{
                    padding: "12px 20px",
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isPending || (step === 0 && !form.name.trim())}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: isPending || (step === 0 && !form.name.trim()) ? "var(--bg-elevated)" : "var(--accent)",
                  color: isPending || (step === 0 && !form.name.trim()) ? "var(--text-muted)" : "#000",
                  border: "none",
                  borderRadius: "var(--radius)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isPending || (step === 0 && !form.name.trim()) ? "not-allowed" : "pointer",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {isPending ? "Setting up..." : step < STEPS.length - 1 ? "Continue" : "Enter the community"}
              </button>
              {step === 2 && !isPending && (
                <button
                  type="button"
                  onClick={handleFinish}
                  style={{
                    padding: "12px 20px",
                    background: "none",
                    color: "var(--text-muted)",
                    border: "none",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Skip
                </button>
              )}
            </div>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          You can update all of this later in your profile settings.
        </p>
      </div>
    </div>
  )
}
