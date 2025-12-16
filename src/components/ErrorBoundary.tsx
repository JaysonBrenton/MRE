/**
 * @fileoverview React error boundary component
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 * 
 * @description Error boundary for catching and handling React component errors
 * 
 * @purpose Prevents entire page crashes when components throw errors. Provides
 *          graceful error handling and user-friendly error messages.
 * 
 * @relatedFiles
 * - src/app/layout.tsx (should wrap application)
 */

"use client"

import React from "react"
import { logger } from "@/lib/logger"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-red-500/20 bg-red-500/10 p-6">
        <h2 className="mb-4 text-xl font-semibold text-red-400">Something went wrong</h2>
        <p className="mb-4 text-sm text-gray-300">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        {process.env.NODE_ENV === "development" && error && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-gray-400">Error details</summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-900 p-2 text-xs text-red-300">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <button
          onClick={resetError}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

/**
 * Error boundary component for catching React component errors
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    logger.error("React component error", {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
    })
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />
    }

    return this.props.children
  }
}

