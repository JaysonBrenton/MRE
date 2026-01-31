/**
 * @fileoverview Client-side logging utility
 *
 * @created 2026-01-04
 * @creator Codex
 * @lastModified 2026-01-04
 *
 * @description Lightweight logger for browser-only code paths.
 *
 * @purpose Provides a safe logging API for client components without pulling in
 *          server-only dependencies (like Prisma). Mirrors the server logger
 *          surface so components can swap imports without behavioural changes.
 *
 * @relatedFiles
 * - src/lib/logger.ts (server logger that persists to the database)
 */

/**
 * Shape of the logger API shared with the server implementation.
 * Re-declared here to avoid importing server modules into the client bundle.
 */
export interface ClientLogger {
  debug: (message: string, context?: Record<string, unknown>) => void
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, context?: Record<string, unknown>) => void
  withContext: (additionalContext: Record<string, unknown>) => ClientLogger
}

function formatEntry(level: string, message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const contextStr = context ? ` ${JSON.stringify(context)}` : ""
  return `[${timestamp}] [${level}] ${message}${contextStr}`
}

function mergeContext(
  base?: Record<string, unknown>,
  additional?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!base && !additional) {
    return undefined
  }
  return {
    ...(base || {}),
    ...(additional || {}),
  }
}

function createClientLogger(baseContext?: Record<string, unknown>): ClientLogger {
  const log = (
    level: "DEBUG" | "INFO" | "WARN" | "ERROR",
    message: string,
    context?: Record<string, unknown>
  ) => {
    const mergedContext = mergeContext(baseContext, context)
    const entry = formatEntry(level, message, mergedContext)

    switch (level) {
      case "DEBUG":
        if (process.env.NODE_ENV === "development") {
          console.debug(entry)
        }
        break
      case "INFO":
        console.info(entry)
        break
      case "WARN":
        console.warn(entry)
        break
      case "ERROR":
        console.error(entry)
        break
    }
  }

  return {
    debug: (message, context) => log("DEBUG", message, context),
    info: (message, context) => log("INFO", message, context),
    warn: (message, context) => log("WARN", message, context),
    error: (message, context) => log("ERROR", message, context),
    withContext: (additionalContext) =>
      createClientLogger(mergeContext(baseContext, additionalContext)),
  }
}

export const clientLogger = createClientLogger()
