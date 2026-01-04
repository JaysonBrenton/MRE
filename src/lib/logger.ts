/**
 * @fileoverview Structured logging utility
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-29
 * 
 * @description Provides structured logging functionality to replace console.* calls
 * 
 * @purpose Centralizes logging logic and provides structured logging that can be
 *          easily extended for production logging services. In development, logs
 *          to console. In production, can be extended to send to logging services.
 *          Logs are persisted to the database for admin console viewing.
 * 
 * @relatedFiles
 * - All files that currently use console.* (to be migrated)
 * - src/lib/request-context.ts (request context utilities)
 * - src/core/admin/logs.ts (log retrieval for admin console)
 */

/**
 * Persist log entry to database (async, non-blocking)
 * Uses dynamic import to avoid bundling Prisma client on the client side
 * This function is only called from server-side code paths
 */
async function persistLog(
  level: string,
  message: string,
  context?: LogContext
): Promise<void> {
  // Skip persistence in client context - multiple checks to ensure webpack doesn't optimize
  if (typeof window !== "undefined") {
    return
  }

  // Additional runtime check - ensure we're in Node.js environment
  if (typeof process === "undefined" || !process.versions?.node) {
    return
  }

  try {
    // Use dynamic import to prevent webpack from bundling Prisma on client side
    // The import is only executed on the server, so env.ts validation won't run on client
    // Using a simple string literal - webpack externals config prevents client bundling
    const prismaModule = await import("./prisma")
    const { prisma } = prismaModule

    // Extract service from context or default to "nextjs"
    const service = (context?.service as string) || "nextjs"

    // Persist asynchronously without blocking
    await prisma.applicationLog.create({
      data: {
        level: level.toLowerCase(),
        message: message.substring(0, 5000), // Limit message length
        service,
        context: context ? (context as Record<string, unknown>) : null,
        requestId: context?.requestId || null,
        userId: context?.userId || null,
        ip: context?.ip || null,
        path: context?.path || null,
        method: context?.method || null,
        userAgent: context?.userAgent || null,
      },
    })
  } catch (error) {
    // Silently fail - don't break application if logging fails
    // Only log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to persist log to database:", error)
    }
  }
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * Request context for logging
 */
export interface LogContext {
  requestId?: string
  userId?: string
  ip?: string
  path?: string
  method?: string
  userAgent?: string
  duration?: number
  statusCode?: number
  [key: string]: unknown
}

/**
 * Log entry structure
 */
interface LogEntry {
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
  return `[${entry.timestamp}] [${entry.level}] ${entry.message}${contextStr}`
}

/**
 * Logger interface with context support
 */
interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, context?: Record<string, unknown>) => void
  withContext: (additionalContext: LogContext) => Logger
}

/**
 * Create a logger instance with base context
 */
function createLoggerInstance(baseContext?: LogContext): Logger {
  const mergeContext = (
    base?: LogContext,
    additional?: Record<string, unknown>
  ): Record<string, unknown> | undefined => {
    if (!base && !additional) return undefined
    return { ...base, ...additional } as Record<string, unknown>
  }

  const loggerInstance: Logger = {
    /**
     * Log debug message
     */
    debug: (message: string, context?: Record<string, unknown>): void => {
      if (process.env.NODE_ENV === "development") {
        const entry: LogEntry = {
          level: LogLevel.DEBUG,
          message,
          context: mergeContext(baseContext, context),
          timestamp: new Date().toISOString(),
        }
        console.debug(formatLogEntry(entry))
      }
      // Persist to database (async, non-blocking)
      persistLog("debug", message, mergeContext(baseContext, context) as LogContext).catch(() => {
        // Ignore errors - logging should never break the application
      })
    },

    /**
     * Log info message
     */
    info: (message: string, context?: Record<string, unknown>): void => {
      const entry: LogEntry = {
        level: LogLevel.INFO,
        message,
        context: mergeContext(baseContext, context),
        timestamp: new Date().toISOString(),
      }
      console.info(formatLogEntry(entry))
      // Persist to database (async, non-blocking)
      persistLog("info", message, mergeContext(baseContext, context) as LogContext).catch(() => {
        // Ignore errors - logging should never break the application
      })
    },

    /**
     * Log warning message
     */
    warn: (message: string, context?: Record<string, unknown>): void => {
      const entry: LogEntry = {
        level: LogLevel.WARN,
        message,
        context: mergeContext(baseContext, context),
        timestamp: new Date().toISOString(),
      }
      console.warn(formatLogEntry(entry))
      // Persist to database (async, non-blocking)
      persistLog("warn", message, mergeContext(baseContext, context) as LogContext).catch(() => {
        // Ignore errors - logging should never break the application
      })
    },

    /**
     * Log error message
     */
    error: (message: string, context?: Record<string, unknown>): void => {
      const entry: LogEntry = {
        level: LogLevel.ERROR,
        message,
        context: mergeContext(baseContext, context),
        timestamp: new Date().toISOString(),
      }
      console.error(formatLogEntry(entry))
      // Persist to database (async, non-blocking)
      persistLog("error", message, mergeContext(baseContext, context) as LogContext).catch(() => {
        // Ignore errors - logging should never break the application
      })
      
      // In production, send to logging service
      // TODO: Integrate with production logging service (e.g., Sentry, DataDog)
    },

    /**
     * Create a new logger instance with additional context
     */
    withContext: (additionalContext: LogContext): Logger => {
      return createLoggerInstance({ ...baseContext, ...additionalContext })
    },
  }

  return loggerInstance
}

/**
 * Default logger instance (no base context)
 */
export const logger = createLoggerInstance()

/**
 * Create a logger instance with request context
 * 
 * @param context - Base context to include in all log entries
 * @returns Logger instance with context
 */
export function createLoggerWithContext(context: LogContext): Logger {
  return createLoggerInstance(context)
}

