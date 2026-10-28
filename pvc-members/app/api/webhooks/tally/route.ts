import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Tally field labels -> our DB fields
const FIELD_MAP: Record<string, string> = {
  "you name":                                          "name",
  "your name":                                         "name",
  "what's the single biggest challenge in your business right now?": "challenge",
  "what's your main goal over the next 3-6 months?":   "goal",
  "what would make pvc genuinely valuable to you?":    "valuableTo",
  "what do you actually want from the room?":          "wantsFrom",
  "what can you offer the room?":                      "canOffer",
  "anything specific we should know to support you properly?": "extraNotes",
}

function mapFields(fields: any[]): Record<string, any> {
  const result: Record<string, any> = {}
  for (const field of fields) {
    const label = (field.label ?? "").toLowerCase().trim()
    const key = FIELD_MAP[label]
    if (!key) continue
    const value = field.value
    if (key === "wantsFrom") {
      // multi-select comes as array of option labels
      result[key] = Array.isArray(value)
        ? value.map((v: any) => (typeof v === "object" ? v.text ?? v : v))
        : value
          ? [value]
          : []
    } else {
      result[key] = typeof value === "string" ? value.trim() : value ?? null
    }
  }
  return result
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fields: any[] = body?.data?.fields ?? []

    const mapped = mapFields(fields)

    await db.onboardingResponse.create({
      data: {
        name:       mapped.name        ?? "Unknown",
        challenge:  mapped.challenge   ?? null,
        goal:       mapped.goal        ?? null,
        valuableTo: mapped.valuableTo  ?? null,
        wantsFrom:  mapped.wantsFrom   ?? [],
        canOffer:   mapped.canOffer    ?? null,
        extraNotes: mapped.extraNotes  ?? null,
        rawPayload: body,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[tally webhook]", err)
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }
}
