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
 * Structured logger
 */
export const logger = {
  /**
   * Log debug message
   */
  debug: (message: string, context?: Record<string, unknown>): void => {
    if (process.env.NODE_ENV === "development") {
      const entry: LogEntry = {
        level: LogLevel.DEBUG,
        message,
        context,
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
      context,
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
      context,
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
      context,
      timestamp: new Date().toISOString(),
    }
    console.error(formatLogEntry(entry))
    
    // In production, send to logging service
    // TODO: Integrate with production logging service (e.g., Sentry, DataDog)
  },
}

