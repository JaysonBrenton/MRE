/**
 * @fileoverview Authentication constants
 *
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 *
 * @description Constants for authentication and password requirements
 *
 * @purpose Centralizes magic numbers and strings used in authentication logic
 *          to improve maintainability and consistency.
 *
 * @relatedFiles
 * - src/core/auth/validate-register.ts (uses these constants)
 */

/**
 * Password requirements configuration
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
} as const

/**
 * Common passwords that should be rejected
 */
export const COMMON_PASSWORDS = [
  "password",
  "12345678",
  "qwerty",
  "password123",
  "admin123",
  "letmein",
  "welcome",
  "monkey",
  "1234567890",
  "abc123",
] as const

/**
 * Rate limiting constants (in milliseconds)
 */
export const RATE_LIMIT_WINDOWS = {
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  INGESTION_WINDOW_MS: 60 * 1000, // 1 minute
  GENERAL_WINDOW_MS: 60 * 1000, // 1 minute
} as const

/**
 * API timeout constants (in seconds)
 */
export const API_TIMEOUTS = {
  INGESTION_MAX_DURATION: 600, // 10 minutes
} as const
