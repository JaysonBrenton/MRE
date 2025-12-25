/**
 * @fileoverview Registration page component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client-side registration page with form handling
 * 
 * @purpose Provides the user registration interface. This is a client component that
 *          handles form submission and calls the registration API endpoint. After
 *          successful registration, users are automatically signed in and redirected
 *          to the welcome page.
 * 
 * @relatedFiles
 * - src/app/api/v1/auth/register/route.ts (registration API endpoint)
 * - src/core/auth/register.ts (registration business logic)
 * - src/lib/auth.ts (NextAuth signIn function)
 */

"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { signIn } from "@/lib/auth-client"
import { logger } from "@/lib/logger"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [driverName, setDriverName] = useState("")
  const [teamName, setTeamName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let response: Response
      try {
        response = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            driverName,
            teamName: teamName || undefined,
          }),
        })
      } catch (fetchError) {
        // Network error or fetch failed
        logger.error("Registration fetch error", {
          error: fetchError instanceof Error
            ? {
                name: fetchError.name,
                message: fetchError.message,
              }
            : String(fetchError),
        })
        if (fetchError instanceof TypeError && fetchError.message.includes("fetch")) {
          setError("Network error. Please check your connection and try again.")
        } else {
          setError("Failed to connect to server. Please try again.")
        }
        setLoading(false)
        return
      }

      // Check response status before parsing JSON
      if (!response.ok) {
        // Check if response is HTML (Next.js error page) instead of JSON
        const contentType = response.headers.get("content-type")
        const isHTML = contentType?.includes("text/html")
        
        if (isHTML) {
          // Server returned HTML error page (likely unhandled error)
          logger.error("Registration API returned HTML error page instead of JSON", {
            status: response.status,
            statusText: response.statusText,
            contentType
          })
          setError("Server error occurred. Please check your database connection and server logs.")
          setLoading(false)
          return
        }
        
        // Try to parse error response as JSON
        let errorMessage = "Registration failed"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error?.message || errorData.error || `Registration failed (${response.status})`
        } catch (jsonError) {
          // Response is not JSON, use status text
          logger.error("Failed to parse error response as JSON", {
            error: jsonError instanceof Error
              ? {
                  name: jsonError.name,
                  message: jsonError.message,
                }
              : String(jsonError),
          })
          errorMessage = `Registration failed: ${response.statusText || `HTTP ${response.status}`}`
        }
        logger.error("Registration API error", {
          status: response.status,
          message: errorMessage
        })
        setError(errorMessage)
        setLoading(false)
        return
      }

      // Parse successful response
      const contentType = response.headers.get("content-type")
      const isJSON = contentType?.includes("application/json")
      
      if (!isJSON) {
        logger.error("Registration API returned non-JSON response", {
          contentType,
          status: response.status
        })
        setError("Server returned invalid response format. Please try again.")
        setLoading(false)
        return
      }
      
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        logger.error("Failed to parse success response as JSON", {
          error: jsonError instanceof Error
            ? {
                name: jsonError.name,
                message: jsonError.message,
              }
            : String(jsonError),
        })
        setError("Server returned invalid response. Please try again.")
        setLoading(false)
        return
      }

      // Auto sign in after registration using NextAuth v5 client API
      try {
        await signIn("credentials", {
          email,
          password,
          redirect: false,
        })
        router.push("/dashboard")
        router.refresh()
      } catch (signInError) {
        // Registration succeeded but auto-login failed, redirect to login
        logger.warn("Registration succeeded but auto-login failed", {
          error: signInError instanceof Error
            ? {
                name: signInError.name,
                message: signInError.message,
              }
            : String(signInError),
        })
        router.push("/login?registered=true")
      }
    } catch (err) {
      // Unexpected error
      logger.error("Unexpected registration error", {
        error: err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack,
            }
          : String(err),
      })
      if (err instanceof Error) {
        setError(`An error occurred: ${err.message}`)
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
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
            Create an account
          </h1>
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
            Sign up to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {hasError && (
            <div
              id="register-error"
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
                aria-describedby={hasError ? "register-error" : undefined}
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-3 text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
                placeholder="••••••••"
                aria-invalid={hasError}
                aria-describedby={hasError ? "register-error" : undefined}
              />
              <p className="mt-1 text-xs text-[var(--token-text-muted)]">
                Must be at least 8 characters
              </p>
            </div>

            <div className="mobile-form-field">
              <label
                htmlFor="driverName"
                className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1"
              >
                Driver Name
              </label>
              <input
                id="driverName"
                name="driverName"
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="block w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-3 text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
                placeholder="Your display name"
                aria-invalid={hasError}
                aria-describedby={hasError ? "register-error" : undefined}
              />
            </div>

            <div className="mobile-form-field">
              <label
                htmlFor="teamName"
                className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1"
              >
                Team Name <span className="text-[var(--token-text-muted)]">(optional)</span>
              </label>
              <input
                id="teamName"
                name="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="block w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-3 text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
                placeholder="Your team name"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="mobile-button w-full flex justify-center items-center px-4 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] active:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>

          <div className="text-center text-sm pt-2">
            <span className="text-[var(--token-text-secondary)]">
              Already have an account?{" "}
            </span>
            <Link
              href="/login"
              className="font-medium text-[var(--token-text-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
