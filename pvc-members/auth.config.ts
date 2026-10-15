import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const protectedPaths = ["/feed", "/spaces", "/members", "/events", "/messages", "/profile", "/admin"]
      const isProtected = protectedPaths.some(p => nextUrl.pathname.startsWith(p))
      if (isProtected) return isLoggedIn
      return true
    },
    async jwt({ token, user, trigger, session: updatedSession }) {
      if (user) {
        token.id = user.id
        token.name = user.name ?? null
        token.role = (user as any).role ?? "GA"
      }
      if (trigger === "update" && updatedSession) {
        if (updatedSession.name !== undefined) token.name = updatedSession.name
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        session.user.name = (token.name as string) ?? session.user.name
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
