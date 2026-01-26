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
import { NextResponse } from "next/server"

// Lazy-load the authorize function to prevent Edge Runtime from analyzing argon2 imports
// This function is only called during actual authentication (Node.js runtime)
async function getAuthorizeFunction() {
  const { authorizeCredentials } = await import("@/core/auth/authorize-handler")
  return authorizeCredentials
}

import { env } from "./env"

/**
 * Public API endpoint prefixes that do not require authentication
 */
export const publicApiPrefixes = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/health",
  "/api/v1/health",
] as const

/**
 * Check if a given pathname is a public API endpoint
 *
 * @param pathname - The pathname to check
 * @returns true if the pathname matches a public API prefix
 */
export function isPublicApi(pathname: string): boolean {
  return publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))
}

export const config = {
  secret: env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
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
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `${env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.NODE_ENV === "production", // Only send over HTTPS in production
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log("[NextAuth JWT] Setting token from user:", {
          userId: user.id,
          userIdType: typeof user.id,
          email: user.email,
          name: user.name,
          isAdmin: (user as User).isAdmin,
        })
        token.id = user.id
        token.email = user.email
        token.name = user.name
        // Type assertion is safe because authorizeCredentials returns User with isAdmin
        token.isAdmin = (user as User).isAdmin ?? false
      } else {
        console.log("[NextAuth JWT] No user, token.id:", {
          tokenId: token.id,
          tokenIdType: typeof token.id,
          tokenIdLength: token.id?.length,
          hasTokenId: !!token.id,
        })
      }
      return token
    },
    async session({ session, token }) {
      console.log("[NextAuth Session] Creating session from token:", {
        tokenId: token.id,
        tokenIdType: typeof token.id,
        tokenIdLength: token.id?.length,
        hasTokenId: !!token.id,
        tokenEmail: token.email,
        tokenName: token.name,
        tokenIsAdmin: token.isAdmin,
      })
      
      const sessionUser = {
        id: String(token.id || ""),
        email: String(token.email || ""),
        name: String(token.name || ""),
        isAdmin: Boolean(token.isAdmin || false),
      }
      
      console.log("[NextAuth Session] Session user:", {
        id: sessionUser.id,
        idType: typeof sessionUser.id,
        idLength: sessionUser.id.length,
        isEmpty: sessionUser.id === "",
        email: sessionUser.email,
        name: sessionUser.name,
        isAdmin: sessionUser.isAdmin,
      })
      
      // Return session with user data from token
      // Use Object.create to avoid prototype issues
      return {
        expires: session.expires,
        user: sessionUser,
      }
    },
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname
      const isLoggedIn = Boolean(auth?.user)
      const isApiRoute = pathname.startsWith("/api/")
      const isAdminRoute = pathname.startsWith("/admin")
      const isRoot = pathname === "/"
      const isLogin = pathname.startsWith("/login")
      const isRegister = pathname.startsWith("/register")
      const isApiAuthRoute = pathname.startsWith("/api/auth")
      const isPublicApiRoute = isPublicApi(pathname)
      const isPublicPage = isLogin || isRegister

      if (!isLoggedIn) {
        if (isPublicPage || isApiAuthRoute || isPublicApiRoute) {
          return true
        }

        if (isApiRoute) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "UNAUTHORIZED",
                message: "Authentication required",
              },
            },
            { status: 401 }
          )
        }

        return NextResponse.redirect(new URL("/login", nextUrl))
      }

      if (isRoot) {
        // Redirect authenticated users from root to their appropriate page
        if (auth?.user?.isAdmin) {
          return NextResponse.redirect(new URL("/admin", nextUrl))
        }
        return NextResponse.redirect(new URL("/dashboard", nextUrl))
      }

      if (isPublicPage || isApiAuthRoute || isPublicApiRoute) {
        if (isLogin || isRegister) {
          // Redirect authenticated users away from login/register pages
          if (auth?.user?.isAdmin) {
            return NextResponse.redirect(new URL("/admin", nextUrl))
          }
          return NextResponse.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      if (isAdminRoute && !auth?.user?.isAdmin) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl))
      }

      // Protect admin API routes
      const isAdminApiRoute = pathname.startsWith("/api/v1/admin")
      if (isAdminApiRoute && !auth?.user?.isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Admin access required",
            },
          },
          { status: 403 }
        )
      }

      if (pathname.startsWith("/event-search") && auth?.user?.isAdmin) {
        return NextResponse.redirect(new URL("/admin", nextUrl))
      }

      return true
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)
