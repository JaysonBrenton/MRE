/**
 * @fileoverview User welcome page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Welcome page for authenticated regular users
 * 
 * @purpose This page redirects users to their appropriate destination.
 *          The redirect is primarily handled in middleware to avoid Next.js
 *          performance measurement errors. This component serves as a fallback
 *          client-side redirect if middleware doesn't catch it.
 * 
 * @relatedFiles
 * - middleware.ts (primary redirect handling)
 * - src/app/(authenticated)/admin/page.tsx (admin console)
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - src/lib/auth.ts (session check)
 */

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function WelcomePage() {
  const router = useRouter()

  useEffect(() => {
    // This page should never render as middleware handles the redirect
    // This is a fallback client-side redirect
    router.replace("/dashboard")
  }, [router])

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg">Redirecting...</p>
      </div>
    </div>
  )
}
