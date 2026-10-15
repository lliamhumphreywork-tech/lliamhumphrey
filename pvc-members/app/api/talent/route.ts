import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const LANDING_URL = "https://privatevictoriesclub.com"
const MEMBERS_API_TOKEN = process.env.MEMBERS_API_TOKEN

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch Tally entries + local ManualTalentEntries in parallel
  const [tallyEntries, manualEntries] = await Promise.all([
    MEMBERS_API_TOKEN
      ? fetch(`${LANDING_URL}/api/talent-public`, {
          headers: { Authorization: `Bearer ${MEMBERS_API_TOKEN}` },
          next: { revalidate: 300 },
        })
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      : Promise.resolve([]),
    db.manualTalentEntry.findMany({ orderBy: { createdAt: "desc" } }),
  ])

  // Build a set of emails already in Tally to avoid duplicates
  const tallyEmails = new Set(
    (tallyEntries as any[]).map((e: any) => (e.email ?? "").toLowerCase())
  )

  // Normalize ManualTalentEntry rows to match Tally shape
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
      location: e.location ?? "",
      source: e.source,
    }))

  return NextResponse.json([...(tallyEntries as any[]), ...normalised])
}
