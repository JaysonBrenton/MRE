/**
 * @fileoverview Login page component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client-side login page with form handling
 * 
 * @purpose Provides the user login interface. This is a client component that handles
 *          form submission and calls the authenticate server action. After successful
 *          login, users are redirected to their appropriate page (welcome or admin).
 * 
 * @relatedFiles
 * - src/app/actions/auth.ts (authenticate server action)
 * - src/core/auth/login.ts (authentication business logic)
 * - src/lib/auth.ts (NextAuth configuration)
 */

"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { authenticate } from "../actions/auth"

/**
 * Type guard to check if error is a NextAuth redirect error
 * NextAuth throws redirect errors with a digest property starting with "NEXT_REDIRECT"
 */
function isNextRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData()
    formData.append("email", email)
    formData.append("password", password)
    
    try {
      let result: string | undefined
      try {
        result = await authenticate(undefined, formData)
      } catch (authError) {
        // Handle server action errors
        console.error("Authentication server action error:", authError)
        
        // Check if it's a network/connection error
        if (authError instanceof Error) {
          if (authError.message.includes("fetch") || authError.message.includes("network")) {
            setError("Network error. Please check your connection and try again.")
          } else {
            setError(`Authentication error: ${authError.message}`)
          }
        } else {
          setError("Failed to connect to authentication server. Please try again.")
        }
        setLoading(false)
        return
      }
      
      if (result) {
        // result is a string error message from the server action
        // This is an expected validation error, not a system error
        // Use console.warn instead of console.error to avoid triggering Next.js error overlay
        console.warn("Authentication failed:", result)
        setError(result)
        setLoading(false)
        return
      }

      // Success - NextAuth's signIn will handle redirect via middleware
      // But we'll also manually redirect to ensure it happens
      router.refresh()
      
      // Check session and redirect to appropriate page
      // Add error handling for session endpoint
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        
        if (!response.ok) {
          // If session endpoint fails, just redirect to welcome page
          console.warn("Session endpoint returned error, redirecting to welcome:", {
            status: response.status,
            statusText: response.statusText
          })
          router.push("/welcome")
          return
        }
        
        let session
        try {
          session = await response.json()
        } catch (jsonError) {
          console.error("Failed to parse session response:", jsonError)
          router.push("/welcome")
          return
        }

        if (session?.user?.isAdmin) {
          router.push("/admin")
        } else {
          router.push("/welcome")
        }
      } catch (sessionError) {
        // If session check fails, just redirect to welcome page
        console.warn("Failed to check session, redirecting to welcome:", sessionError)
        router.push("/welcome")
      }
    } catch (err: unknown) {
      // NextAuth's signIn throws a redirect error on success (expected)
      // Use type guard to safely check for redirect errors
      if (isNextRedirectError(err)) {
        // This is a redirect, which means login succeeded
        // Let NextAuth handle the redirect
        router.refresh()
        return
      }
      
      // Real error occurred
      console.error("Unexpected login error:", err)
      if (err instanceof Error) {
        setError(`An error occurred: ${err.message}`)
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--token-surface)] px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-[var(--token-surface-elevated)] p-6 sm:p-8 shadow-lg">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-[var(--token-error-background)] p-3">
              <p className="text-sm text-[var(--token-error-text)]">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="mobile-form-field">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-3 text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
                placeholder="you@example.com"
              />
            </div>

            <div className="mobile-form-field">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-3 text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="mobile-button w-full flex justify-center items-center px-4 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] active:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="text-center text-sm pt-2">
            <span className="text-[var(--token-text-secondary)]">
              Don't have an account?{" "}
            </span>
            <Link
              href="/register"
              className="font-medium text-[var(--token-text-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
            >
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}


