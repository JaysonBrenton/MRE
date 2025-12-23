/**
 * @fileoverview NextAuth providers wrapper component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client-side providers wrapper for NextAuth session management
 * 
 * @purpose This component provides a wrapper for NextAuth session providers.
 *          In NextAuth v5, SessionProvider is no longer required, so this
 *          component simply passes through its children. It's maintained for
 *          consistency and potential future provider additions.
 * 
 * @relatedFiles
 * - src/app/layout.tsx (uses this component)
 * - src/lib/auth.ts (NextAuth configuration)
 */

"use client"

import { ReactNode } from "react"
import GlobalErrorHandler from "./GlobalErrorHandler"

export default function Providers({ children }: { children: ReactNode }) {
  // NextAuth v5 doesn't require SessionProvider
  return (
    <>
      <GlobalErrorHandler />
      {children}
    </>
  )
}

