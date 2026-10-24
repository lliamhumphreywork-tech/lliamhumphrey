"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Camera, Users, Trophy, Calendar, Briefcase, BookOpen } from "lucide-react"
import { uploadAvatar } from "@/lib/uploadAvatar"
import { AvatarCropper } from "@/components/ui/AvatarCropper"

const STEPS = ["Welcome", "About you", "Socials", "Your community"]

const field: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: 16,
  outline: "none",
  fontFamily: "var(--s, sans-serif)",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
  WebkitAppearance: "none",
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
    <div className="ob-field">
      <label className="ob-label">
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
        autoComplete="off"
      />
    </div>
  )
}

const TOUR_SECTIONS = [
  {
    icon: Users,
    name: "Feed",
    description: "The main community space. Share updates, ask questions, or just check in with the community.",
  },
  {
    icon: Trophy,
    name: "Wins",
    description: "Post your victories, big or small. This is where we celebrate what's actually working.",
  },
  {
    icon: Calendar,
    name: "Events",
    description: "Upcoming dinners, masterminds, and retreats before they're announced publicly. Plus community calls.",
  },
  {
    icon: Briefcase,
    name: "Talent Network",
    description: "A curated directory of vetted talent recommended by members. Developers, designers, operators.",
  },
  {
    icon: BookOpen,
    name: "Resources",
    description: "Frameworks, templates, and tools shared by the community. Things that actually move the needle.",
  },
]

export function OnboardingFlow({ email }: { email: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [step])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropFile(file)
    e.target.value = ""
  }

  async function handleCropConfirm(blob: Blob) {
    setCropFile(null)
    setUploadingAvatar(true)
    setError("")
    try {
      const croppedFile = new File([blob], "avatar.jpg", { type: "image/jpeg" })
      const url = await uploadAvatar(croppedFile)
      setForm((f) => ({ ...f, avatar: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Try a different image.")
    } finally {
      setUploadingAvatar(false)
    }
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
        window.location.href = "/feed"
      } else {
        setError("Something went wrong. Please try again.")
      }
    })
  }

  const headings = [
    "Welcome to the community",
    "Tell us about yourself",
    "Connect your socials",
    "Here's what's inside",
  ]
  const subheadings = [
    `Let's set up your profile, ${email.split("@")[0]}.`,
    "Help members get to know you.",
    "Optional, you can skip this.",
    "A quick look at what's waiting for you.",
  ]

  return (
    <div className="ob-root" ref={rootRef}>
      <div className="ob-inner">

        {/* Header */}
        <div className="ob-header">
          <p className="ob-eyebrow">Private Victories Club</p>
          <h1 className="ob-heading">{headings[step]}</h1>
          <p className="ob-sub">{subheadings[step]}</p>
        </div>

        {/* Progress */}
        <div className="ob-progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="ob-progress-bar"
              style={{ background: i <= step ? "var(--accent)" : "var(--border)" }}
            />
          ))}
        </div>

        {/* Card */}
        <div className="ob-card">
          <form onSubmit={next}>

            {/* Step 0: Photo + Name */}
            {step === 0 && (
              <>
                <div className="ob-avatar-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="ob-avatar-btn"
                  >
                    {form.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.avatar.includes("blob.vercel-storage.com") && !form.avatar.includes(".public.blob.") ? `/api/img?url=${encodeURIComponent(form.avatar)}` : form.avatar}
                        alt="Your photo"
                        className="ob-avatar-img"
                      />
                    ) : uploadingAvatar ? (
                      <div className="ob-spinner" />
                    ) : (
                      <Camera size={28} style={{ color: "var(--text-muted)" }} />
                    )}
                    {/* Camera badge always visible on touch devices, hover on desktop */}
                    {form.avatar && (
                      <div className="ob-avatar-badge">
                        <Camera size={14} color="#fff" />
                      </div>
                    )}
                  </button>
                  <p className="ob-avatar-hint">
                    {uploadingAvatar ? "Uploading..." : form.avatar ? "Tap to change" : "Add a photo"}
                  </p>
                </div>

                <FieldInput
                  label="Display name"
                  value={form.name}
                  onChange={(v) => set("name", v)}
                  placeholder="Your full name"
                  required
                />
              </>
            )}

            {/* Step 1: Bio + location + website */}
            {step === 1 && (
              <>
                <div className="ob-field">
                  <label className="ob-label">Bio</label>
                  <textarea
                    className="ob-textarea"
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder="What are you building? What do you do? What's your story?"
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                </div>
                <FieldInput label="Location" value={form.location} onChange={(v) => set("location", v)} placeholder="Cape Town, South Africa" />
                <FieldInput label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://yoursite.com" type="url" />
              </>
            )}

            {/* Step 2: Socials */}
            {step === 2 && (
              <>
                <FieldInput label="Twitter / X" value={form.twitter} onChange={(v) => set("twitter", v)} placeholder="username (no @)" />
                <FieldInput label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} placeholder="username (no @)" />
                <FieldInput label="LinkedIn" value={form.linkedin} onChange={(v) => set("linkedin", v)} placeholder="username or profile URL" />
              </>
            )}

            {/* Step 3: Tour */}
            {step === 3 && (
              <div className="ob-tour">
                {TOUR_SECTIONS.map(({ icon: Icon, name, description }) => (
                  <div key={name} className="ob-tour-item">
                    <div className="ob-tour-icon">
                      <Icon size={16} style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                      <p className="ob-tour-name">{name}</p>
                      <p className="ob-tour-desc">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="ob-error">{error}</p>}

            <div className="ob-actions">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="ob-btn-back"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isPending || (step === 0 && !form.name.trim())}
                className={`ob-btn-primary${isPending || (step === 0 && !form.name.trim()) ? " ob-btn-disabled" : ""}`}
              >
                {isPending ? "Setting up..." : step === 3 ? "Enter the community" : "Continue"}
              </button>
              {(step === 1 || step === 2) && !isPending && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="ob-btn-skip"
                >
                  Skip
                </button>
              )}
            </div>
          </form>
        </div>

        <p className="ob-footer-note">You can update all of this later in your profile settings.</p>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      <style>{`
        .ob-root {
          height: 100dvh;
          overflow-y: auto;
          background: var(--bg-base);
          padding: 24px 16px 40px;
          box-sizing: border-box;
        }
        .ob-inner {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          padding-top: 16px;
        }
        .ob-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .ob-eyebrow {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .ob-heading {
          font-family: var(--g, sans-serif);
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 6px;
          line-height: 1.2;
        }
        .ob-sub {
          color: var(--text-secondary);
          font-size: 15px;
          line-height: 1.5;
        }
        .ob-progress {
          display: flex;
          gap: 6px;
          margin-bottom: 20px;
        }
        .ob-progress-bar {
          flex: 1;
          height: 3px;
          border-radius: 99px;
          transition: background 0.3s;
        }
        .ob-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px 20px;
        }
        .ob-avatar-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 24px;
        }
        .ob-avatar-btn {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: var(--bg-elevated);
          border: 2px dashed var(--border);
          cursor: pointer;
          position: relative;
          overflow: visible;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          -webkit-tap-highlight-color: transparent;
        }
        .ob-avatar-img {
          width: 96px;
          height: 96px;
          object-fit: cover;
          border-radius: 50%;
          display: block;
        }
        .ob-avatar-badge {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 26px;
          height: 26px;
          background: var(--accent);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--bg-surface);
        }
        .ob-avatar-badge svg { color: #000 !important; }
        .ob-avatar-hint {
          font-size: 13px;
          color: var(--text-muted);
        }
        .ob-spinner {
          width: 22px;
          height: 22px;
          border: 2px solid var(--accent);
          border-top-color: transparent;
          border-radius: 50%;
          animation: ob-spin 0.7s linear infinite;
        }
        .ob-field {
          margin-bottom: 18px;
        }
        .ob-label {
          display: block;
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        .ob-textarea {
          width: 100%;
          padding: 14px 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-primary);
          font-size: 16px;
          outline: none;
          font-family: var(--s, sans-serif);
          transition: border-color 0.15s;
          box-sizing: border-box;
          resize: vertical;
          min-height: 100px;
          -webkit-appearance: none;
        }
        .ob-tour {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ob-tour-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          background: var(--bg-elevated);
          border-radius: var(--radius);
          border: 1px solid var(--border);
        }
        .ob-tour-icon {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          background: var(--accent-dim, rgba(200,255,0,0.08));
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ob-tour-name {
          font-family: var(--g, sans-serif);
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .ob-tour-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .ob-error {
          color: var(--danger, #f44);
          font-size: 13px;
          margin-top: 10px;
        }
        .ob-actions {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }
        .ob-btn-back {
          padding: 14px 18px;
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          font-family: var(--s, sans-serif);
          white-space: nowrap;
          min-height: 50px;
          -webkit-tap-highlight-color: transparent;
        }
        .ob-btn-primary {
          flex: 1;
          padding: 14px;
          background: var(--accent);
          color: #000;
          border: none;
          border-radius: var(--radius);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--s, sans-serif);
          transition: opacity 0.15s;
          min-height: 50px;
          -webkit-tap-highlight-color: transparent;
        }
        .ob-btn-primary.ob-btn-disabled {
          background: var(--bg-elevated);
          color: var(--text-muted);
          cursor: not-allowed;
        }
        .ob-btn-skip {
          padding: 14px 16px;
          background: none;
          color: var(--text-muted);
          border: none;
          font-size: 14px;
          cursor: pointer;
          font-family: var(--s, sans-serif);
          white-space: nowrap;
          min-height: 50px;
          -webkit-tap-highlight-color: transparent;
        }
        .ob-footer-note {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
          color: var(--text-muted);
        }
        @keyframes ob-spin { to { transform: rotate(360deg) } }

        @media (min-width: 480px) {
          .ob-root { padding: 40px 24px; }
          .ob-heading { font-size: 30px; }
          .ob-card { padding: 32px; }
          .ob-header { margin-bottom: 36px; }
        }
      `}</style>
    </div>
  )
}
