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
import { logger } from "@/lib/logger"

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
      logger.error("Uncaught JavaScript error", {
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
      logger.error("Unhandled promise rejection", {
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

