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
 * Log entry to be persisted
 */
interface PendingLogEntry {
  level: string
  message: string
  context?: LogContext
}

/**
 * Log buffer for batching database writes
 */
class LogBuffer {
  private buffer: PendingLogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private flushPromise: Promise<void> | null = null
  private readonly maxBufferSize = 50
  private readonly flushIntervalMs = 5000 // 5 seconds

  constructor() {
    // Start periodic flush
    this.startFlushInterval()
  }

  private startFlushInterval(): void {
    if (this.flushInterval) {
      return
    }
    this.flushInterval = setInterval(() => {
      this.flush().catch(() => {
        // Ignore errors - logging should never break the application
      })
    }, this.flushIntervalMs)
  }

  /**
   * Add log entry to buffer
   */
  add(level: string, message: string, context?: LogContext): void {
    this.buffer.push({ level, message, context })

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush().catch(() => {
        // Ignore errors - logging should never break the application
      })
    }
  }

  /**
   * Flush all buffered logs to database
   */
  async flush(): Promise<void> {
    // If already flushing, wait for it to complete
    if (this.flushPromise) {
      return this.flushPromise
    }

    if (this.buffer.length === 0) {
      return
    }

    // Create a new promise for this flush operation
    this.flushPromise = this.doFlush()

    try {
      await this.flushPromise
    } finally {
      this.flushPromise = null
    }
  }

  private async doFlush(): Promise<void> {
    const logsToFlush = this.buffer.splice(0)

    if (logsToFlush.length === 0) {
      return
    }

    // Skip persistence in client context
    if (typeof window !== "undefined") {
      return
    }

    // Additional runtime check - ensure we're in Node.js environment
    if (typeof process === "undefined" || !process.versions?.node) {
      return
    }

    try {
      // Use dynamic import to prevent webpack from bundling Prisma on client side
      // Wrap in try-catch to handle synchronous errors from import
      let prismaModule
      try {
        prismaModule = await import("./prisma")
      } catch (importError) {
        // Handle import errors (e.g., module not found, webpack issues)
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to import Prisma module for logging:", importError)
        }
        return
      }

      const { prisma } = prismaModule

      // Batch insert logs with error handling
      try {
        await prisma.applicationLog.createMany({
          data: logsToFlush.map((log) => ({
            level: log.level.toLowerCase(),
            message: log.message.substring(0, 5000), // Limit message length
            service: (log.context?.service as string) || "nextjs",
            context: log.context ? JSON.parse(JSON.stringify(log.context)) : undefined,
            requestId: log.context?.requestId || null,
            userId: log.context?.userId || null,
            ip: log.context?.ip || null,
            path: log.context?.path || null,
            method: log.context?.method || null,
            userAgent: log.context?.userAgent || null,
          })),
          skipDuplicates: true, // Skip duplicates if any
        })
      } catch (dbError) {
        // Handle database errors (connection issues, schema problems, etc.)
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to persist logs to database:", dbError)
        }
        // Don't rethrow - logging failures should not break the application
      }
    } catch (error) {
      // Catch any other unexpected errors
      // Silently fail - don't break application if logging fails
      // Only log to console in development
      if (process.env.NODE_ENV === "development") {
        console.error("Unexpected error in log flush:", error)
      }
    }
  }

  /**
   * Force flush and cleanup (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    await this.flush()
  }
}

// Singleton log buffer instance
let logBuffer: LogBuffer | null = null

function getLogBuffer(): LogBuffer {
  if (!logBuffer) {
    logBuffer = new LogBuffer()
  }
  return logBuffer
}

/**
 * Persist log entry to database (async, non-blocking, buffered)
 * Uses dynamic import to avoid bundling Prisma client on the client side
 * This function is only called from server-side code paths
 * Logs are buffered and flushed in batches to reduce database write load
 */
function persistLog(level: string, message: string, context?: LogContext): void {
  // Skip persistence in client context - multiple checks to ensure webpack doesn't optimize
  if (typeof window !== "undefined") {
    return
  }

  // Additional runtime check - ensure we're in Node.js environment
  if (typeof process === "undefined" || !process.versions?.node) {
    return
  }

  // Add to buffer instead of writing immediately
  try {
    getLogBuffer().add(level, message, context)
  } catch (error) {
    // Silently fail - don't break application if logging fails
    // Only log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to add log to buffer:", error)
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
      // Persist to database (async, non-blocking, buffered)
      persistLog("debug", message, mergeContext(baseContext, context) as LogContext)
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
      // Persist to database (async, non-blocking, buffered)
      persistLog("info", message, mergeContext(baseContext, context) as LogContext)
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
      // Persist to database (async, non-blocking, buffered)
      persistLog("warn", message, mergeContext(baseContext, context) as LogContext)
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
      // Persist to database (async, non-blocking, buffered)
      // Errors are flushed immediately to ensure they're not lost
      persistLog("error", message, mergeContext(baseContext, context) as LogContext)
      // Force flush for errors to ensure they're persisted quickly
      getLogBuffer()
        .flush()
        .catch(() => {
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
