"use client"

import { cn } from "@/lib/utils"

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 rounded disabled:opacity-40 disabled:cursor-not-allowed"

const variants = {
  primary: "bg-accent text-black hover:bg-accent-hover",
  secondary: "bg-bg-elevated text-tx-primary border border-border hover:bg-bg-hover",
  ghost: "bg-transparent text-tx-secondary hover:bg-bg-hover hover:text-tx-primary",
  danger: "bg-transparent text-red-400 border border-red-400/30 hover:bg-red-400/10",
}

const sizes = {
  sm: "text-[13px] px-3 py-1.5",
  md: "text-[14px] px-4 py-2",
  lg: "text-[15px] px-5 py-2.5",
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}
