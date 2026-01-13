/**
 * @fileoverview In-memory lock for preventing concurrent ingestion requests
 * 
 * @created 2025-02-07
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-02-07
 * 
 * @description Provides a simple in-memory lock mechanism to prevent multiple
 *              concurrent ingestion requests for the same event. This reduces
 *              wasted API resources when multiple requests try to ingest the
 *              same event simultaneously.
 * 
 * @purpose Prevents race conditions in ingestion status checking by ensuring
 *          only one ingestion request per event can be in progress at a time.
 *          Note: This is per-instance. For multi-instance deployments, consider
 *          using Redis-based locking.
 */

/**
 * Lock entry tracking when a lock was acquired
 */
interface LockEntry {
  eventId: string
  acquiredAt: number
}

/**
 * In-memory lock store
 * Maps eventId to lock entry
 */
const locks = new Map<string, LockEntry>()

/**
 * Maximum lock duration (5 minutes)
 * Locks are automatically released after this time to prevent deadlocks
 */
const MAX_LOCK_DURATION_MS = 5 * 60 * 1000

/**
 * Cleanup interval to remove stale locks
 */
let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Start automatic cleanup of stale locks
 */
function startCleanup(): void {
  if (cleanupInterval) {
    return
  }

  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [eventId, entry] of locks.entries()) {
      // Remove locks that are older than max duration
      if (now - entry.acquiredAt > MAX_LOCK_DURATION_MS) {
        locks.delete(eventId)
      }
    }
  }, 60 * 1000) // Run cleanup every minute

  // Ensure interval doesn't prevent process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }
}

// Start cleanup on module load
startCleanup()

/**
 * Try to acquire a lock for an event
 * 
 * @param eventId - Event ID to lock
 * @returns true if lock was acquired, false if already locked
 */
export function tryAcquireLock(eventId: string): boolean {
  const now = Date.now()
  
  // Check if lock exists and is still valid
  const existingLock = locks.get(eventId)
  if (existingLock) {
    // Check if lock has expired
    if (now - existingLock.acquiredAt > MAX_LOCK_DURATION_MS) {
      // Lock expired, remove it and acquire new one
      locks.delete(eventId)
    } else {
      // Lock is still valid
      return false
    }
  }

  // Acquire lock
  locks.set(eventId, {
    eventId,
    acquiredAt: now,
  })

  return true
}

/**
 * Release a lock for an event
 * 
 * @param eventId - Event ID to unlock
 */
export function releaseLock(eventId: string): void {
  locks.delete(eventId)
}

/**
 * Check if an event is currently locked
 * 
 * @param eventId - Event ID to check
 * @returns true if locked, false if not
 */
export function isLocked(eventId: string): boolean {
  const lock = locks.get(eventId)
  if (!lock) {
    return false
  }

  // Check if lock has expired
  const now = Date.now()
  if (now - lock.acquiredAt > MAX_LOCK_DURATION_MS) {
    // Lock expired, remove it
    locks.delete(eventId)
    return false
  }

  return true
}

/**
 * Get the number of active locks (for monitoring)
 */
export function getLockCount(): number {
  return locks.size
}

