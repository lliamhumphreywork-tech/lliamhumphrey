import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const SHEETS = [
  {
    id: "188TKQSg2wcfPtAmBgvyhNbG7WMOZutJh8Xi7x1_ib-g",
    gid: "731828544",
    source: "sales-roles",
    label: "Sales Roles",
    // Maps column keyword → field name
    parse: (headers: string[], row: string[]) => {
      const h = (kw: string) => headers.findIndex(h => h.toLowerCase().includes(kw.toLowerCase()))
      const iName  = h("full name")
      const iEmail = h("email")
      const iPhone = h("whatsapp")
      const iLoc   = h("country")
      const iRole  = h("role")
      const iExper = h("how long")
      const iHours = h("hours")
      const iProof = h("loom")
      const iTs    = h("timestamp")
      return {
        name:       row[iName]  ?? "",
        email:      row[iEmail] ?? "",
        phone:      row[iPhone] ?? "",
        location:   row[iLoc]   ?? "",
        role:       row[iRole]  ?? "",
        experience: row[iExper] ?? "",
        hours:      row[iHours] ?? "",
        proof:      row[iProof] ?? "",
        timestamp:  row[iTs]    ?? "",
        context:    "",
      }
    },
  },
  {
    id: "1KHzlzYb5YVGRwx2jEgxD55sca7qVMMCqLabwyQzBjEs",
    gid: "2079033386",
    source: "hybrid-closer",
    label: "Hybrid Closer",
    parse: (headers: string[], row: string[]) => {
      const h = (kw: string) => headers.findIndex(h => h.toLowerCase().includes(kw.toLowerCase()))
      const safe = (i: number) => (i >= 0 ? row[i] ?? "" : "")
      const iTs      = h("timestamp")
      const iName    = h("full name")
      const iEmail   = h("whatsapp")   // mislabeled — contains email
      const iIG      = h("ig handle")
      const iLoc     = h("timezone")
      const iOffers  = h("offers you")
      const iProof   = h("recording")
      const iCC      = h("cc do you have")
      // Sanity-check: name should look like a person's name, not a deal description
      const rawName  = safe(iName)
      const nameOk   = rawName.length > 0 && rawName.length < 80 && /[a-zA-Z]/.test(rawName)
      return {
        name:       nameOk ? rawName : "",
        email:      safe(iEmail),
        phone:      "",
        location:   safe(iLoc),
        role:       "Closer",
        experience: safe(iOffers),
        hours:      "",
        proof:      safe(iProof),
        timestamp:  safe(iTs),
        context:    safe(iCC) ? `CC last 90d: ${safe(iCC)}` : "",
      }
    },
  },
]

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cells: string[] = []
  let cur = ""
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuote && next === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === "," && !inQuote) {
      cells.push(cur.trim()); cur = ""
    } else if ((ch === "\n" || ch === "\r") && !inQuote) {
      if (ch === "\r" && next === "\n") i++ // skip CRLF pair
      cells.push(cur.trim())
      if (cells.some(c => c)) rows.push(cells)
      cells = []; cur = ""
    } else {
      cur += ch
    }
  }
  // flush last cell/row
  cells.push(cur.trim())
  if (cells.some(c => c)) rows.push(cells)

  return rows
}

async function fetchSheet(sheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return null
  const ct = res.headers.get("content-type") ?? ""
  // If Google redirected to a login page, content-type is text/html — skip it
  if (ct.includes("text/html")) return null
  return res.text()
}

// GET — fetch applicants from both Google Sheets
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any)?.role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Already-imported emails (to flag duplicates across both sheets)
  const existing = await db.manualTalentEntry.findMany({ select: { email: true } })
  const importedEmails = new Set(existing.map(e => e.email.toLowerCase()))

  // Fetch both sheets in parallel
  const csvResults = await Promise.all(SHEETS.map(s => fetchSheet(s.id, s.gid)))

  const applicants: object[] = []
  let idx = 0

  for (let si = 0; si < SHEETS.length; si++) {
    const sheet = SHEETS[si]
    const csv = csvResults[si]
    if (!csv) continue

    const rows = parseCSV(csv)
    if (rows.length < 2) continue
    const [headers, ...data] = rows

    for (const row of data) {
      if (!row.some(c => c)) continue
      const fields = sheet.parse(headers, row)
      applicants.push({
        id:          `gs-${si}-${idx++}`,
        sheetSource: sheet.source,
        sheetLabel:  sheet.label,
        imported:    importedEmails.has(fields.email.toLowerCase()),
        ...fields,
      })
    }
  }

  return NextResponse.json(applicants)
}

// POST — approve selected applicants
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any)?.role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { applicants } = await req.json() as {
    applicants: {
      name: string; email: string; phone: string; location: string
      role: string; experience: string; hours: string; proof: string
      context: string; sheetSource: string
    }[]
  }

  if (!Array.isArray(applicants) || applicants.length === 0) {
    return NextResponse.json({ error: "No applicants provided" }, { status: 400 })
  }

  const created = await db.manualTalentEntry.createMany({
    data: applicants.map(a => {
      const skillLabel =
        a.role === "Both" ? "Sales Setter & Closer"
        : a.role === "Closer" ? "Sales Closer"
        : `Sales ${a.role}`

      const notesParts = [
        a.experience && `${a.experience} experience`,
        a.hours       && `${a.hours}/day available`,
        a.context     && a.context,
      ].filter(Boolean)

      return {
        name:      a.name.trim(),
        email:     a.email.trim().toLowerCase(),
        phone:     a.phone?.trim() || null,
        location:  a.location?.trim() || null,
        skills:    skillLabel,
        proof:     a.proof?.startsWith("http") ? a.proof.trim() : null,
        notes:     notesParts.join(" · ") || null,
        source:    a.sheetSource ?? "google-forms",
        addedById: session!.user!.id!,
      }
    }),
    skipDuplicates: true,
  })

  return NextResponse.json({ added: created.count })
}
