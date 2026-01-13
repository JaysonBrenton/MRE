/**
 * @fileoverview Safe localStorage utility with error handling
 * 
 * @created 2025-02-07
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-02-07
 * 
 * @description Provides safe localStorage operations with error handling
 *              and logging. Gracefully degrades when localStorage is unavailable.
 * 
 * @purpose Prevents silent failures when localStorage is unavailable
 *          (e.g., private browsing mode, storage quota exceeded) and
 *          provides debugging information.
 */

import { logger } from "./logger"

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined") {
      return false
    }
    const testKey = "__localStorage_test__"
    window.localStorage.setItem(testKey, "test")
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Safely get an item from localStorage
 * 
 * @param key - Storage key
 * @returns Item value or null if unavailable/error
 */
export function safeGetItem(key: string): string | null {
  if (!isLocalStorageAvailable()) {
    logger.debug("localStorage not available", { key })
    return null
  }

  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    logger.warn("Failed to get item from localStorage", {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Safely set an item in localStorage
 * 
 * @param key - Storage key
 * @param value - Value to store
 * @returns true if successful, false otherwise
 */
export function safeSetItem(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) {
    logger.debug("localStorage not available", { key })
    return false
  }

  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isQuotaError = errorMessage.includes("QuotaExceeded") || errorMessage.includes("quota")
    
    logger.warn("Failed to set item in localStorage", {
      key,
      error: errorMessage,
      isQuotaError,
    })

    // Optionally show user-visible warning for quota errors
    if (isQuotaError && typeof window !== "undefined") {
      // Log to console for user visibility (in development)
      if (process.env.NODE_ENV === "development") {
        console.warn("Storage quota exceeded. Some preferences may not be saved.")
      }
    }

    return false
  }
}

/**
 * Safely remove an item from localStorage
 * 
 * @param key - Storage key
 * @returns true if successful, false otherwise
 */
export function safeRemoveItem(key: string): boolean {
  if (!isLocalStorageAvailable()) {
    logger.debug("localStorage not available", { key })
    return false
  }

  try {
    window.localStorage.removeItem(key)
    return true
  } catch (error) {
    logger.warn("Failed to remove item from localStorage", {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

