import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: ["/feed/:path*", "/spaces/:path*", "/members/:path*", "/events/:path*", "/messages/:path*", "/profile/:path*", "/admin/:path*", "/onboarding"],
}
