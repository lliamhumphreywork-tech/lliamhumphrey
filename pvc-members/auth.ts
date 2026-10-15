import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Email from "next-auth/providers/nodemailer"
import { db } from "@/lib/db"
import { sendMagicLink } from "@/lib/brevo"
import { authConfig } from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session: updatedSession }) {
      if (user) {
        token.id = user.id
        token.name = user.name ?? null
        // PrismaAdapter may not include custom fields — fetch role from DB
        const dbUser = await db.user.findUnique({ where: { id: user.id as string }, select: { role: true } })
        token.role = dbUser?.role ?? "GA"
      }
      if (trigger === "update" && updatedSession) {
        if (updatedSession.name !== undefined) token.name = updatedSession.name
      }
      return token
    },
  },
  providers: [
    Email({
      server: "smtp://localhost:25",
      from: process.env.BREVO_FROM_EMAIL ?? "lliam@privatevictoriesclub.com",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await sendMagicLink({ email, url })
      },
    }),
  ],
})
