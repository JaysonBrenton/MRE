/**
 * @fileoverview Client-safe NextAuth exports
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client-safe exports from NextAuth that don't require the full config
 * 
 * @purpose This file provides client-safe exports of NextAuth functions (signIn, signOut)
 *          using NextAuth v5's client-side API. This prevents client components from
 *          pulling in the authorize function and argon2 dependencies by using the
 *          client-side API directly instead of importing from the server-side auth module.
 * 
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth server-side configuration)
 */

"use client"

// Use NextAuth v5's client-side API directly
// This avoids importing from @/lib/auth which would pull in the authorize function
// and argon2 dependencies during client-side bundling
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react"

// Re-export with the same API as the server-side version
export const signIn = nextAuthSignIn
export const signOut = nextAuthSignOut

