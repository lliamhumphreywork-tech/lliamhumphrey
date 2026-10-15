import { cn } from "@/lib/utils"

type BadgeProps = {
  role: "GA" | "ADMIN" | "VIP" | string
  className?: string
}

const styles: Record<string, { background: string; color: string; label: string }> = {
  GA: {
    background: "var(--ga-dim)",
    color: "var(--ga)",
    label: "Member",
  },
  VIP: {
    background: "var(--ga-dim)",
    color: "var(--ga)",
    label: "Member",
  },
  ADMIN: {
    background: "rgba(239,68,68,0.1)",
    color: "#ef4444",
    label: "Admin",
  },
}

export function Badge({ role, className }: BadgeProps) {
  const s = styles[role] ?? styles.GA
  return (
    <span
      className={cn(className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
        background: s.background,
        color: s.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  )
}
