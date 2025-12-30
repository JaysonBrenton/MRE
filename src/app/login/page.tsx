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
import Footer from "@/components/Footer"
import { authenticate } from "../actions/auth"
import { logger } from "@/lib/logger"
import { getSession } from "@/lib/auth-client"

type LoginFieldErrors = {
  email?: string
  password?: string
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const registrationSuccess = searchParams.get("registered") === "true"
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})

  const clearFieldError = (field: keyof LoginFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validateForm = () => {
    const nextErrors: LoginFieldErrors = {}
    if (!email.trim()) {
      nextErrors.email = "Email is required"
    }
    if (!password.trim()) {
      nextErrors.password = "Password is required"
    }
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    const isValid = validateForm()
    if (!isValid) {
      return
    }
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
      // Fetch session to check admin status and redirect appropriately
      const session = await getSession()
      if (session?.user?.isAdmin) {
        router.push("/admin")
      } else {
        router.push("/welcome")
      }
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
  const emailErrorId = fieldErrors.email ? "login-email-error" : undefined
  const passwordErrorId = fieldErrors.password ? "login-password-error" : undefined

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)] overflow-x-hidden" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <main
        id="main-content"
        className="page-container flex-1 w-full min-w-0 px-6 py-12"
        tabIndex={-1}
        style={{ width: '100%', minWidth: 0, flexBasis: '100%', boxSizing: 'border-box', flexShrink: 1 }}
      >
        <section className="content-wrapper w-full min-w-0 max-w-2xl" style={{ width: '100%', minWidth: 0, marginLeft: 'auto', marginRight: 'auto', maxWidth: '672px', boxSizing: 'border-box' }}>
          <div className="w-full min-w-0 space-y-8 rounded-lg bg-[var(--token-surface-elevated)] p-8 shadow-lg" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <div>
              <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
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

            <form onSubmit={handleSubmit} className="space-y-6 w-full min-w-0" noValidate style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
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

          <div className="space-y-6 w-full min-w-0" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <div>
              <label
                htmlFor="email"
                className="block text-base font-medium text-[var(--token-text-secondary)] mb-2"
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearFieldError("email")
                }}
                className="block w-full min-w-0 rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-4 py-3 text-base text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                placeholder="you@example.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={emailErrorId}
              />
              {fieldErrors.email && (
                <p id={emailErrorId} className="mt-2 text-sm text-[var(--token-error-text)]">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-base font-medium text-[var(--token-text-secondary)] mb-2"
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
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearFieldError("password")
                }}
                className="block w-full min-w-0 rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-4 py-3 text-base text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                placeholder="••••••••"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={passwordErrorId}
              />
              {fieldErrors.password && (
                <p id={passwordErrorId} className="mt-2 text-sm text-[var(--token-error-text)]">
                  {fieldErrors.password}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-6 py-3 rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] text-base font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] active:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="text-center text-base pt-4">
            <span className="text-[var(--token-text-secondary)]">
              Don&rsquo;t have an account?{" "}
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
    </section>
      </main>
      <Footer />
    </div>
  )
}
