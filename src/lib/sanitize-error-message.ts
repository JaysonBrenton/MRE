/**
 * @fileoverview Sanitizes error messages for safe display to end users.
 *
 * @description Detects technical error patterns (Python exceptions, stack traces,
 *              implementation details) and replaces them with user-friendly messages.
 *              End users should never see raw AttributeError, KeyError, tracebacks, etc.
 *
 * @purpose Prevents leaking technical implementation details to the UI.
 */

/** Patterns that indicate a technical (non-user-facing) error message */
const TECHNICAL_PATTERNS = [
  /\bAttributeError\b/i,
  /\bKeyError\b/i,
  /\bTypeError\b/i,
  /\bValueError\b/i,
  /\bIndexError\b/i,
  /\bRuntimeError\b/i,
  /\bImportError\b/i,
  /\bModuleNotFoundError\b/i,
  /\bNoneType\b/i,
  /\bobject has no attribute\b/i,
  /\bhas no attribute\b/i,
  /\bargument of type\b/i,
  /\b'NoneType' object\b/i,
  /\btraceback\b/i,
  /\bFile ".*", line \d+/i,
  /\bTypeError:.*Expected\b/i,
  /\berror_type\b/i,
  /\bexc_info\b/i,
  /\bECONNREFUSED\b/i,
  /\bENOTFOUND\b/i,
  /\bgetaddrinfo\b/i,
  /\bEAI_AGAIN\b/i,
  /\bsocket\s+hang\s+up\b/i,
  /\bETIMEDOUT\b/i,
  /\bfetch failed\b/i,
  /\bCannot read propert(?:y|ies) of undefined\b/i,
  /\bundefined is not an object\b/i,
  // Database / SQL / ORM errors
  /\bpsycopg2\./i,
  /\bUniqueViolation\b/i,
  /\bIntegrityError\b/i,
  /\bOperationalError\b/i,
  /\bduplicate key value violates/i,
  /\bviolates unique constraint\b/i,
  /\bviolates.*constraint\b/i,
  /\b\[SQL:\s/i,
  /\bINSERT INTO\b/i,
  /\b\[parameters:/i,
  /\bDETAIL:\s*Key\b/i,
  /\bsqlalche\.me\b/i,
  /\bSession\.rollback\b/i,
  /\btransaction has been rolled back\b/i,
]

/** Default friendly message when a technical error is detected */
const FRIENDLY_FALLBACK =
  "Something went wrong while refreshing event data. Please try again. If the problem persists, try again later or contact support."

/**
 * Returns true if the message appears to be a technical error that
 * should not be shown to end users.
 */
export function isTechnicalError(message: string | null | undefined): boolean {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return false
  }
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * Sanitizes an error message for safe display to end users.
 * If the message contains technical details (Python exceptions, stack traces, etc.),
 * returns a friendly fallback instead.
 *
 * @param message - Raw error message (possibly technical)
 * @param fallback - Optional custom fallback (default: generic refresh failure message)
 * @returns User-safe message to display
 */
export function sanitizeErrorMessage(
  message: string | null | undefined,
  fallback: string = FRIENDLY_FALLBACK
): string {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return fallback
  }
  const trimmed = message.trim()
  if (isTechnicalError(trimmed)) {
    return fallback
  }
  return trimmed
}
