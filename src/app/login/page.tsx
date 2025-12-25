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

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { authenticate } from "../actions/auth"
import { logger } from "@/lib/logger"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const registrationSuccess = searchParams.get("registered") === "true"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData()
    formData.append("email", email)
    formData.append("password", password)
    try {
      const result = await authenticate(undefined, formData)
      if (result) {
        logger.warn("Authentication failed", { reason: result })
        setError(result)
        setLoading(false)
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch (authError) {
      logger.error("Unexpected login error", {
        error: authError instanceof Error
          ? {
              name: authError.name,
              message: authError.message,
              stack: authError.stack,
            }
          : String(authError),
      })
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  const hasError = Boolean(error)

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-[var(--token-surface)] px-4 py-8"
      tabIndex={-1}
    >
      <div className="w-full max-w-md space-y-6 rounded-lg bg-[var(--token-surface-elevated)] p-6 sm:p-8 shadow-lg">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
            Sign in to your account
          </p>
        </div>

        {registrationSuccess && !hasError && (
          <div
            className="rounded-md border border-[var(--token-status-success-text)] bg-[var(--token-status-success-bg)] p-3"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-[var(--token-status-success-text)]">
              Registration successful. Sign in to start analysing events.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {hasError && (
            <div
              id="login-error"
              className="rounded-md bg-[var(--token-error-background)] p-3"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
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
                aria-invalid={hasError}
                aria-describedby={hasError ? "login-error" : undefined}
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
                aria-invalid={hasError}
                aria-describedby={hasError ? "login-error" : undefined}
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
    </main>
  )
}
