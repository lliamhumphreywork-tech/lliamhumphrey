import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    const secret = process.env.CAL_WEBHOOK_SECRET
    if (secret) {
      const sig = req.headers.get("X-Cal-Signature-256") ?? ""
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
      if (sig !== expected) {
        console.error("[cal-booking] Invalid signature")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    } else {
      console.warn("[cal-booking] CAL_WEBHOOK_SECRET not set — running unauthenticated")
    }

    const body = JSON.parse(rawBody)

    if (body.triggerEvent !== "BOOKING_CREATED") {
      return NextResponse.json({ ok: true })
    }

    const { payload } = body
    const attendee = payload.attendees?.[0]
    const name = attendee?.name ?? "Unknown"
    const title = payload.title ?? "Call"
    const startTime = payload.startTime
    const location = payload.location

    const formatted = formatSAST(startTime)

    const lines = [
      `📅 *New call booked*`,
      ``,
      `*${name}* — ${title}`,
      `${formatted} SAST`,
    ]
    if (location) lines.push(``, location)

    const text = lines.join("\n")

    const webhookUrl = process.env.SLACK_BOOKING_WEBHOOK_URL
    if (!webhookUrl) {
      console.error("[cal-booking] SLACK_BOOKING_WEBHOOK_URL not set")
      return NextResponse.json({ ok: false, error: "no webhook url" }, { status: 500 })
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[cal-booking] Slack post failed:", err)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[cal-booking] Error:", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

function formatSAST(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return iso
  }
}
