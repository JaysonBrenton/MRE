/**
 * @fileoverview NextAuth configuration and authentication setup
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description NextAuth configuration for credential-based authentication
 * 
 * @purpose This file configures NextAuth for the MRE application. It sets up
 *          credential-based authentication, JWT session strategy, and authorization
 *          callbacks. The authorize function uses the core authenticateUser function
 *          to maintain separation of concerns while providing NextAuth integration.
 * 
 * @relatedFiles
 * - src/core/auth/login.ts (authentication business logic)
 * - src/lib/session.ts (session helpers)
 * - middleware.ts (route protection)
 */

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"
import type { User } from "next-auth"

// Lazy-load the authorize function to prevent Edge Runtime from analyzing argon2 imports
// This function is only called during actual authentication (Node.js runtime)
async function getAuthorizeFunction() {
  const { authorizeCredentials } = await import("@/core/auth/authorize-handler")
  return authorizeCredentials
}

import { env } from "./env"

export const config = {
  secret: env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Only import and execute in Node.js runtime (not Edge Runtime)
        // This check ensures argon2 (native Node.js module) is never loaded in Edge Runtime
        if (typeof process === "undefined" || !process.versions?.node) {
          // Edge Runtime - should never reach here, but fail safely
          return null
        }
        
        // Dynamically import authorize handler to avoid loading argon2 in Edge Runtime
        // This ensures argon2 (native Node.js module) is only loaded during actual authentication
        const authorizeCredentials = await getAuthorizeFunction()
        return authorizeCredentials(credentials as Record<"email" | "password", string> | undefined)
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        // Type assertion is safe because authorizeCredentials returns User with isAdmin
        token.isAdmin = (user as User).isAdmin ?? false
      }
      return token
    },
    async session({ session, token }) {
      // Return session with user data from token
      // Use Object.create to avoid prototype issues
      return {
        expires: session.expires,
        user: {
          id: String(token.id || ""),
          email: String(token.email || ""),
          name: String(token.name || ""),
          isAdmin: Boolean(token.isAdmin || false),
        }
      }
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = nextUrl.pathname.startsWith("/login")
      const isOnRegister = nextUrl.pathname.startsWith("/register")
      const isOnWelcome = nextUrl.pathname.startsWith("/welcome")
      const isOnAdmin = nextUrl.pathname.startsWith("/admin")
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")
      const isOnEventSearch = nextUrl.pathname.startsWith("/event-search")
      const isOnEvents = nextUrl.pathname.startsWith("/events")
      const isOnRoot = nextUrl.pathname === "/"

      // Redirect authenticated users from root to welcome
      if (isLoggedIn && isOnRoot) {
        return Response.redirect(new URL("/welcome", nextUrl))
      }

      // Allow public pages
      if (!isOnLogin && !isOnRegister && !isOnWelcome && !isOnAdmin && !isOnDashboard && !isOnEventSearch && !isOnEvents) {
        return true
      }

      // Redirect authenticated users away from login/register
      if (isLoggedIn && (isOnLogin || isOnRegister)) {
        // Type assertion is safe because Session.user is typed with isAdmin in types/next-auth.d.ts
        if (auth?.user?.isAdmin) {
          return Response.redirect(new URL("/admin", nextUrl))
        }
        return Response.redirect(new URL("/welcome", nextUrl))
      }

      // Redirect non-authenticated users from protected pages
      if (!isLoggedIn && (isOnWelcome || isOnAdmin || isOnDashboard || isOnEventSearch || isOnEvents)) {
        return Response.redirect(new URL("/login", nextUrl))
      }

      // Redirect non-admin users from admin pages
      // Type assertion is safe because Session.user is typed with isAdmin in types/next-auth.d.ts
      if (isOnAdmin && isLoggedIn && !auth?.user?.isAdmin) {
        return Response.redirect(new URL("/welcome", nextUrl))
      }

      return true
    }
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)

