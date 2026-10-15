import { BookOpen, Trophy, Network, Layers, type LucideProps } from "lucide-react"
import type { FC } from "react"

const SLUG_MAP: Record<string, FC<LucideProps>> = {
  "wins": Trophy,
  "resources": BookOpen,
  "talent-network": Network,
}

export function getSpaceIcon(slug: string): FC<LucideProps> {
  return SLUG_MAP[slug] ?? Layers
}
