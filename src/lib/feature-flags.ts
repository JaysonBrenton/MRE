/**
 * @fileoverview Feature flag utilities
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Centralized feature flag management
 */

/**
 * Check if practice days feature is enabled
 */
export function isPracticeDaysEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRACTICE_DAYS === "true"
}

/**
 * Check if session type inference is enabled
 */
export function isSessionTypeInferenceEnabled(): boolean {
  return process.env.ENABLE_SESSION_TYPE_INFERENCE === "true"
}
