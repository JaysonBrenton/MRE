/**
 * @fileoverview Frontend API response helper for v1 endpoints
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Helper function for parsing and handling v1 API responses
 *
 * @purpose Provides a consistent way to handle v1 API responses that follow
 *          the standard { success, data | error } envelope format. This helper
 *          does not throw by default, allowing caller code to branch on result.success.
 *
 * @relatedFiles
 * - src/lib/api-utils.ts (server-side response helpers)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (API format standard)
 */

export interface ApiSuccessResult<T = unknown> {
  success: true
  data: T
}

export interface ApiErrorResult {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResult<T = unknown> = ApiSuccessResult<T> | ApiErrorResult

/**
 * Parse a fetch Response into a standardized API result
 *
 * This helper expects v1 API responses to follow the standard envelope:
 * - Success: { success: true, data: T }
 * - Error: { success: false, error: { code, message, details? } }
 *
 * @param response - Fetch Response object
 * @returns ApiResult with success flag and data or error
 */
export async function parseApiResponse<T = unknown>(response: Response): Promise<ApiResult<T>> {
  const contentType = response.headers.get("content-type") ?? ""

  let text: string
  try {
    text = await response.text()
  } catch (error) {
    return {
      success: false,
      error: {
        code: "PARSE_ERROR",
        message: "Failed to read API response",
        details: error instanceof Error ? error.message : String(error),
      },
    }
  }

  if (!text.trim()) {
    return {
      success: false,
      error: {
        code: "PARSE_ERROR",
        message: "Empty response from server",
        details: { status: response.status, contentType },
      },
    }
  }

  let json: unknown
  try {
    json = JSON.parse(text) as unknown
  } catch (error) {
    const trimmed = text.trimStart()
    const looksHtml = trimmed.startsWith("<") || contentType.includes("text/html")
    return {
      success: false,
      error: {
        code: "PARSE_ERROR",
        message: looksHtml
          ? "Server returned HTML instead of JSON (often an auth or server error page)"
          : "Failed to parse API response",
        details: {
          parseError: error instanceof Error ? error.message : String(error),
          status: response.status,
          contentType,
        },
      },
    }
  }

  // Check if response is ok and has success flag
  if (
    !response.ok ||
    (typeof json === "object" && json !== null && "success" in json && json.success !== true)
  ) {
    // Try to extract error from standard envelope
    if (typeof json === "object" && json !== null && "error" in json) {
      const errorObj = (json as { error: unknown }).error
      if (typeof errorObj === "object" && errorObj !== null) {
        const error = errorObj as { code?: string; message?: string; details?: unknown }
        return {
          success: false,
          error: {
            code: error.code || "UNKNOWN_ERROR",
            message: error.message || "An error occurred",
            details: error.details,
          },
        }
      }
    }

    // Fallback error
    return {
      success: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: response.statusText || "An error occurred",
        details: { status: response.status },
      },
    }
  }

  // Extract data from success response
  if (typeof json === "object" && json !== null && "data" in json) {
    return {
      success: true,
      data: (json as { data: T }).data,
    }
  }

  // If no data field, return the whole json as data
  return {
    success: true,
    data: json as T,
  }
}
