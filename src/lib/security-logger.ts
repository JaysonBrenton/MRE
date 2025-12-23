/**
 * @fileoverview Security event logging utilities
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 * 
 * @description Utilities for logging security-related events
 * 
 * @purpose Provides functions to log security events such as failed logins,
 *          rate limit violations, and suspicious activity. Helps with security
 *          monitoring and incident response.
 * 
 * @relatedFiles
 * - src/lib/logger.ts (structured logging)
 * - src/lib/request-context.ts (request context)
 */

import { logger, createLoggerWithContext, type LogContext } from "./logger"

/**
 * Log failed login attempt
 * 
 * @param identifier - Email or username (sanitized - don't log full value)
 * @param ip - Client IP address
 * @param userAgent - User agent string
 * @param reason - Reason for failure (optional)
 * @param context - Optional logging context
 */
export function logFailedLogin(
  identifier: string,
  ip: string,
  userAgent?: string,
  reason?: string,
  context?: LogContext
): void {
  // Sanitize identifier - only log first 3 chars and domain for email
  const sanitizedIdentifier = identifier.includes("@")
    ? `${identifier.substring(0, 3)}***@${identifier.split("@")[1]}`
    : `${identifier.substring(0, 3)}***`

  const requestLogger = context ? createLoggerWithContext(context) : logger
  requestLogger.warn("Failed login attempt", {
    identifier: sanitizedIdentifier,
    ip,
    userAgent,
    reason,
  })
}

/**
 * Log successful login
 * 
 * @param userId - User ID
 * @param identifier - Email or username (sanitized)
 * @param ip - Client IP address
 * @param userAgent - User agent string
 * @param context - Optional logging context
 */
export function logSuccessfulLogin(
  userId: string,
  identifier: string,
  ip: string,
  userAgent?: string,
  context?: LogContext
): void {
  const sanitizedIdentifier = identifier.includes("@")
    ? `${identifier.substring(0, 3)}***@${identifier.split("@")[1]}`
    : `${identifier.substring(0, 3)}***`

  const requestLogger = context ? createLoggerWithContext(context) : logger
  requestLogger.info("Successful login", {
    userId,
    identifier: sanitizedIdentifier,
    ip,
    userAgent,
  })
}

/**
 * Log rate limit violation
 * 
 * @param ip - Client IP address
 * @param path - Request path
 * @param limit - Rate limit that was exceeded
 * @param retryAfter - Seconds until retry is allowed
 * @param context - Optional logging context
 */
export function logRateLimitHit(
  ip: string,
  path: string,
  limit: number,
  retryAfter: number,
  context?: LogContext
): void {
  const requestLogger = context ? createLoggerWithContext(context) : logger
  requestLogger.warn("Rate limit exceeded", {
    ip,
    path,
    limit,
    retryAfter,
  })
}

/**
 * Log suspicious activity
 * 
 * @param activity - Description of suspicious activity
 * @param ip - Client IP address
 * @param details - Additional details
 * @param context - Optional logging context
 */
export function logSuspiciousActivity(
  activity: string,
  ip: string,
  details?: Record<string, unknown>,
  context?: LogContext
): void {
  const requestLogger = context ? createLoggerWithContext(context) : logger
  requestLogger.warn("Suspicious activity detected", {
    activity,
    ip,
    ...details,
  })
}

/**
 * Log session event
 * 
 * @param event - Session event type
 * @param userId - User ID
 * @param ip - Client IP address
 * @param context - Optional logging context
 */
export function logSessionEvent(
  event: "created" | "destroyed" | "expired",
  userId: string,
  ip: string,
  context?: LogContext
): void {
  const requestLogger = context ? createLoggerWithContext(context) : logger
  requestLogger.info(`Session ${event}`, {
    userId,
    ip,
  })
}

