/**
 * @fileoverview Performance logging utilities
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 * 
 * @description Utilities for logging performance metrics
 * 
 * @purpose Provides functions to measure and log slow requests, queries, and operations.
 *          Helps identify performance bottlenecks in the application.
 * 
 * @relatedFiles
 * - src/lib/logger.ts (structured logging)
 * - src/lib/request-context.ts (request context)
 */

import { logger, createLoggerWithContext, type LogContext } from "./logger"

/**
 * Performance thresholds (in milliseconds)
 */
const THRESHOLDS = {
  API_REQUEST: parseInt(process.env.PERF_THRESHOLD_API || "300", 10),
  DATABASE_QUERY: parseInt(process.env.PERF_THRESHOLD_DB || "100", 10),
  EXTERNAL_SERVICE: parseInt(process.env.PERF_THRESHOLD_EXTERNAL || "500", 10),
}

/**
 * Performance timer result
 */
export interface TimerResult {
  duration: number
  logIfSlow: () => void
}

/**
 * Start a performance timer
 * 
 * @param operation - Name of the operation being timed
 * @param context - Optional logging context
 * @returns Timer result with duration and logIfSlow function
 */
export function startTimer(
  operation: string,
  context?: LogContext
): TimerResult {
  const startTime = Date.now()
  const requestLogger = context ? createLoggerWithContext(context) : logger

  return {
    duration: 0,
    logIfSlow: () => {
      const duration = Date.now() - startTime
      if (duration > THRESHOLDS.API_REQUEST) {
        requestLogger.warn("Slow operation detected", {
          operation,
          duration,
          threshold: THRESHOLDS.API_REQUEST,
        })
      }
    },
  }
}

/**
 * Log slow API request
 * 
 * @param path - Request path
 * @param method - HTTP method
 * @param duration - Request duration in milliseconds
 * @param context - Optional logging context
 */
export function logSlowRequest(
  path: string,
  method: string,
  duration: number,
  context?: LogContext
): void {
  if (duration > THRESHOLDS.API_REQUEST) {
    const requestLogger = context ? createLoggerWithContext(context) : logger
    requestLogger.warn("Slow API request", {
      path,
      method,
      duration,
      threshold: THRESHOLDS.API_REQUEST,
    })
  }
}

/**
 * Log slow database query
 * 
 * @param query - Query description or SQL (sanitized)
 * @param duration - Query duration in milliseconds
 * @param context - Optional logging context
 */
export function logSlowQuery(
  query: string,
  duration: number,
  context?: LogContext
): void {
  if (duration > THRESHOLDS.DATABASE_QUERY) {
    const requestLogger = context ? createLoggerWithContext(context) : logger
    requestLogger.warn("Slow database query", {
      query: query.substring(0, 200), // Limit query length
      duration,
      threshold: THRESHOLDS.DATABASE_QUERY,
    })
  }
}

/**
 * Log slow external service call
 * 
 * @param serviceName - Name of the external service
 * @param endpoint - Endpoint called
 * @param duration - Call duration in milliseconds
 * @param context - Optional logging context
 */
export function logSlowExternalService(
  serviceName: string,
  endpoint: string,
  duration: number,
  context?: LogContext
): void {
  if (duration > THRESHOLDS.EXTERNAL_SERVICE) {
    const requestLogger = context ? createLoggerWithContext(context) : logger
    requestLogger.warn("Slow external service call", {
      service: serviceName,
      endpoint,
      duration,
      threshold: THRESHOLDS.EXTERNAL_SERVICE,
    })
  }
}

/**
 * Measure and log operation duration
 * 
 * @param operation - Name of the operation
 * @param fn - Function to execute
 * @param context - Optional logging context
 * @returns Result of the function execution
 */
export async function measureOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const startTime = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - startTime
    
    const requestLogger = context ? createLoggerWithContext(context) : logger
    if (duration > THRESHOLDS.API_REQUEST) {
      requestLogger.warn("Slow operation", {
        operation,
        duration,
        threshold: THRESHOLDS.API_REQUEST,
      })
    }
    
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const requestLogger = context ? createLoggerWithContext(context) : logger
    requestLogger.error("Operation failed", {
      operation,
      duration,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

