import { getInitials } from "@/lib/utils"

type AvatarProps = {
  src?: string | null
  name?: string | null
  size?: number
  online?: boolean
  role?: "GA" | "ADMIN" | "VIP" | string
}

// Deterministic gradient from a string seed
function seedGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  const hue2 = (hue + 40) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,40%), hsl(${hue2},70%,55%))`
}

function proxySrc(src?: string | null): string | undefined {
  if (!src) return undefined
  if (src.startsWith("/api/img")) return src
  if (src.includes("blob.vercel-storage.com") && !src.includes(".public.blob.vercel-storage.com")) {
    return `/api/img?url=${encodeURIComponent(src)}`
  }
  return src
}

export function Avatar({ src, name, size = 36, online, role }: AvatarProps) {
  const initials = getInitials(name)
  const ringColor = role === "ADMIN" ? "var(--accent)" : "transparent"
  const bg = name ? seedGradient(name) : "var(--bg-elevated)"
  const imgSrc = proxySrc(src)

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          background: imgSrc ? "var(--bg-elevated)" : bg,
          border: `2px solid ${ringColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={name ?? "Avatar"}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        ) : (
          <span
            style={{
              fontSize: size * 0.36,
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            {initials}
          </span>
        )}
      </div>
      {online && (
        <div
          className="online-dot"
          style={{
            position: "absolute",
            bottom: 1,
            right: 1,
            width: Math.max(8, size * 0.24),
            height: Math.max(8, size * 0.24),
            borderRadius: "50%",
            background: "var(--success)",
            border: "2px solid var(--bg-base)",
          }}
        />
      )}
    </div>
  )
}
