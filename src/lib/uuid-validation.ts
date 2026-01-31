/**
 * @fileoverview UUID validation utility
 *
 * @created 2025-02-07
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-02-07
 *
 * @description Provides UUID format validation functions
 *
 * @purpose Validates UUID format before passing to database queries to provide
 *          clear error messages and avoid unnecessary database operations.
 */

/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validate if a string is a valid UUID v4 format
 *
 * @param value - String to validate
 * @returns true if valid UUID format, false otherwise
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value)
}

/**
 * Validate UUID and throw error if invalid
 *
 * @param value - String to validate
 * @param fieldName - Name of the field for error message
 * @throws Error if UUID is invalid
 */
export function validateUUID(value: string, fieldName: string = "id"): void {
  if (!isValidUUID(value)) {
    throw new Error(`${fieldName} must be a valid UUID format`)
  }
}
