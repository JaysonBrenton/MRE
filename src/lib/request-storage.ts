/**
 * @fileoverview Request-scoped storage using AsyncLocalStorage
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Provides request-scoped storage for query telemetry and other per-request data
 *
 * @purpose Uses Node.js AsyncLocalStorage to provide isolated storage for each request,
 *          preventing concurrent requests from interfering with each other's metrics.
 *          This solves the issue where module-level variables in prisma.ts caused
 *          query counts and slow queries to be shared across concurrent requests.
 *
 * @relatedFiles
 * - src/lib/prisma.ts (uses this for query telemetry)
 * - src/lib/request-context.ts (reads from this for logging)
 */

import { AsyncLocalStorage } from "async_hooks"

/**
 * Request-scoped storage data structure
 */
export interface RequestStorageData {
  queryCount: number
  slowQueries: Array<{ query: string; duration: number; params?: unknown }>
}

/**
 * AsyncLocalStorage instance for request-scoped data
 *
 * This stores data that is isolated per request/async context.
 * Each request gets its own storage instance, preventing concurrent
 * requests from interfering with each other's metrics.
 */
export const requestStorage = new AsyncLocalStorage<RequestStorageData>()

/**
 * Initialize request storage for the current async context
 *
 * This should be called at the start of each API route handler
 * to initialize the request-scoped storage.
 *
 * @returns The initialized storage data
 */
export function initializeRequestStorage(): RequestStorageData {
  const storage: RequestStorageData = {
    queryCount: 0,
    slowQueries: [],
  }
  requestStorage.enterWith(storage)
  return storage
}

/**
 * Get the current request storage data
 *
 * @returns The current request storage data, or undefined if not initialized
 */
export function getRequestStorage(): RequestStorageData | undefined {
  return requestStorage.getStore()
}

/**
 * Get or initialize request storage
 *
 * If storage is not initialized, initializes it.
 *
 * @returns The current request storage data
 */
export function getOrInitializeRequestStorage(): RequestStorageData {
  const storage = getRequestStorage()
  if (storage) {
    return storage
  }
  return initializeRequestStorage()
}

/**
 * Run a function within a request storage context
 *
 * Useful for wrapping async operations that need request-scoped storage.
 *
 * @param fn - Function to run within the storage context
 * @returns The result of the function
 */
export async function runWithRequestStorage<T>(fn: () => Promise<T> | T): Promise<T> {
  const storage = initializeRequestStorage()
  return requestStorage.run(storage, fn)
}
