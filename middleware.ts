/**
 * @fileoverview Next.js middleware for route protection
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Middleware configuration for authentication and route protection
 * 
 * @purpose This middleware uses NextAuth's auth function to protect routes and
 *          handle authentication redirects. It applies to login, register, welcome,
 *          admin, event-search, and events routes, ensuring proper authentication
 *          flow and access control. The middleware configuration defines which
 *          routes should be processed.
 * 
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration and auth function)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (architecture rules)
 */

export { auth as middleware } from "@/lib/auth"

export const config = {
  matcher: [
    "/login",
    "/register",
    "/welcome",
    "/admin/:path*",
    "/dashboard",
    "/event-search",
    "/events/:path*",
  ],
}

