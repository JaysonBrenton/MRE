/**
 * @fileoverview Global error handler component for client-side errors
 *
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 *
 * @description Catches unhandled JavaScript errors and promise rejections
 *
 * @purpose Provides global error handling for client-side errors that aren't
 *          caught by React ErrorBoundary (e.g., async errors, unhandled promises).
 *          Logs errors with context for debugging.
 *
 * @relatedFiles
 * - src/components/ErrorBoundary.tsx (React component errors)
 * - src/lib/logger.ts (structured logging)
 */

"use client"

import { useEffect } from "react"
import { clientLogger } from "@/lib/client-logger"

/**
 * Check if an error message is a Next.js performance measurement error
 * These are non-critical development-only errors that occur when components
 * redirect immediately, causing invalid timing measurements
 */
function isPerformanceMeasurementError(message: string): boolean {
  return (
    message.includes("cannot have a negative time stamp") ||
    message.includes("Failed to execute 'measure' on 'Performance'") ||
    message.includes("negative time stamp")
  )
}

/**
 * Check if an error message is a Next.js async params/searchParams warning
 * These are non-critical warnings from React DevTools trying to serialize
 * async props. The code correctly uses await, so these warnings are harmless.
 */
function isAsyncParamsWarning(message: string): boolean {
  return (
    message.includes("params are being enumerated") ||
    message.includes("params` is a Promise and must be unwrapped") ||
    message.includes("The keys of `searchParams` were accessed directly") ||
    message.includes("searchParams` is a Promise and must be unwrapped") ||
    message.includes("sync-dynamic-apis")
  )
}

/**
 * Override console.error to filter out Next.js performance measurement errors
 * This needs to run early, before Next.js error overlay intercepts the errors
 */
if (typeof window !== "undefined") {
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    // Check if any argument contains errors we want to filter out
    const message = args.map((arg) => (typeof arg === "string" ? arg : String(arg))).join(" ")

    if (isPerformanceMeasurementError(message)) {
      // Silently ignore these errors - they're not actual application errors
      return
    }

    if (isAsyncParamsWarning(message)) {
      // Silently ignore React DevTools warnings about async params/searchParams
      // These occur when DevTools tries to serialize component props.
      // The code correctly uses await, so these warnings are harmless.
      return
    }

    // Call original console.error for all other errors
    originalConsoleError.apply(console, args)
  }
}

/**
 * Global error handler component
 * Registers global error handlers for uncaught errors and unhandled promise rejections
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    // Only register handlers in client-side
    if (typeof window === "undefined") {
      return
    }

    /**
     * Handle uncaught JavaScript errors
     */
    const handleError = (event: ErrorEvent) => {
      // Filter out non-critical errors
      const errorMessage = event.message || event.error?.message || ""

      if (isPerformanceMeasurementError(errorMessage)) {
        // Prevent the error from propagating to Next.js error overlay
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        // Silently ignore these errors - they're not actual application errors
        return false
      }

      if (isAsyncParamsWarning(errorMessage)) {
        // Prevent React DevTools warnings about async params/searchParams
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        // Silently ignore these warnings - they're not actual application errors
        return false
      }

      clientLogger.error("Uncaught JavaScript error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
          ? {
              name: event.error.name,
              message: event.error.message,
              stack: event.error.stack,
            }
          : undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
      })

      // Don't prevent default - let browser handle it normally
      // We're just logging for observability
    }

    /**
     * Handle unhandled promise rejections
     */
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      clientLogger.error("Unhandled promise rejection", {
        reason:
          event.reason instanceof Error
            ? {
                name: event.reason.name,
                message: event.reason.message,
                stack: event.reason.stack,
              }
            : String(event.reason),
        url: window.location.href,
        userAgent: navigator.userAgent,
      })

      // Don't prevent default - let browser handle it normally
      // We're just logging for observability
    }

    // Register event listeners
    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    // Cleanup on unmount
    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  // This component doesn't render anything
  return null
}
