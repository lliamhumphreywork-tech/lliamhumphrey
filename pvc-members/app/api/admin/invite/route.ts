import { NextResponse } from "next/server"
import { db as prisma } from "@/lib/db"
import crypto from "crypto"

const PORTAL_BASE_URL = process.env.NEXTAUTH_URL ?? "https://members.privatevictoriesclub.com"

async function generateMagicLink(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  })
  const callbackUrl = encodeURIComponent(PORTAL_BASE_URL)
  const encodedEmail = encodeURIComponent(email)
  return `${PORTAL_BASE_URL}/api/auth/callback/email?callbackUrl=${callbackUrl}&token=${token}&email=${encodedEmail}`
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (token !== process.env.MEMBERS_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, name, memberSince, renewalDate, plan } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const normalised = email.toLowerCase().trim()
  const membershipData = {
    ...(memberSince ? { memberSince: new Date(memberSince) } : {}),
    ...(renewalDate ? { renewalDate: new Date(renewalDate) } : {}),
    ...(plan ? { plan } : {}),
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, email: true },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { ...(name ? { name } : {}), ...membershipData },
    })
    // Still generate a magic link for existing users so a re-triggered onboarding email works
    const magicLink = await generateMagicLink(normalised).catch(() => null)
    return NextResponse.json({ id: existing.id, email: existing.email, created: false, magicLink })
  }

  const user = await prisma.user.create({
    data: { email: normalised, name: name || null, role: "GA", ...membershipData },
  })

  const magicLink = await generateMagicLink(normalised).catch(() => null)
  return NextResponse.json({ id: user.id, email: user.email, created: true, magicLink })
}
