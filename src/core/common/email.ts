/**
 * @fileoverview Email normalization utility
 *
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 *
 * @description Centralized email normalization function
 *
 * @purpose Provides a single source of truth for email normalization logic.
 *          Emails should be normalized to lowercase and trimmed per RFC 5321,
 *          which states that email addresses are case-insensitive.
 *
 * @relatedFiles
 * - src/core/auth/login.ts (uses this for email normalization)
 * - src/core/users/repo.ts (uses this for email normalization)
 * - src/core/auth/validate-register.ts (uses this for email normalization)
 */

/**
 * Normalizes an email address to lowercase and trims whitespace
 *
 * Per RFC 5321, email addresses are case-insensitive. This function
 * ensures consistent storage and lookup of email addresses.
 *
 * @param email - Email address to normalize
 * @returns Normalized email address (lowercase, trimmed)
 *
 * @example
 * ```typescript
 * normalizeEmail("  User@Example.COM  ") // Returns "user@example.com"
 * ```
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
