/**
 * @fileoverview Structured logging utility
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 * 
 * @description Provides structured logging functionality to replace console.* calls
 * 
 * @purpose Centralizes logging logic and provides structured logging that can be
 *          easily extended for production logging services. In development, logs
 *          to console. In production, can be extended to send to logging services.
 * 
 * @relatedFiles
 * - All files that currently use console.* (to be migrated)
 * - src/lib/request-context.ts (request context utilities)
 */

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

