import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const LANDING_URL = "https://privatevictoriesclub.com"
const MEMBERS_API_TOKEN = process.env.MEMBERS_API_TOKEN

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await req.json()
  await db.manualTalentEntry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { email, roleOverride, availability, social } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const override = await db.talentOverride.upsert({
    where: { email },
    update: { roleOverride: roleOverride ?? null, availability: availability ?? null, social: social ?? null },
    create: { email, roleOverride: roleOverride ?? null, availability: availability ?? null, social: social ?? null },
  })

  return NextResponse.json(override)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [tallyEntries, manualEntries, overrides] = await Promise.all([
    MEMBERS_API_TOKEN
      ? fetch(`${LANDING_URL}/api/talent-public`, {
          headers: { Authorization: `Bearer ${MEMBERS_API_TOKEN}` },
          next: { revalidate: 300 },
        })
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      : Promise.resolve([]),
    db.manualTalentEntry.findMany({ orderBy: { createdAt: "desc" } }),
    db.talentOverride.findMany(),
  ])

  const overrideMap = new Map(overrides.map(o => [o.email.toLowerCase(), o]))

  const tallyEmails = new Set(
    (tallyEntries as any[]).map((e: any) => (e.email ?? "").toLowerCase())
  )

  const normalised = manualEntries
    .filter(e => !tallyEmails.has(e.email.toLowerCase()))
    .map(e => ({
      id: e.id,
      name: e.name,
      email: e.email,
      phone: e.phone ?? "",
      skills: e.skills,
      proof: e.proof ?? "",
      notes: e.notes ?? "",
      rate: e.rate ?? "",
      capacity: e.capacity ?? "",
      source: e.source,
      _manual: true,
    }))

  const applyOverride = (entry: any) => {
    const ov = overrideMap.get((entry.email ?? "").toLowerCase())
    if (!ov) return entry
    return {
      ...entry,
      ...(ov.roleOverride ? { roleOverride: ov.roleOverride } : {}),
      ...(ov.availability ? { availability: ov.availability } : {}),
      ...(ov.social ? { social: ov.social } : {}),
    }
  }

  const all = [
    ...(tallyEntries as any[]).map(applyOverride),
    ...normalised.map(applyOverride),
  ]

  return NextResponse.json(all)
}
