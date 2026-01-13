/**
 * @fileoverview In-memory rate limiter using sliding window algorithm
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-02-07
 * 
 * @description Provides rate limiting functionality for API endpoints
 * 
 * @purpose Protects authentication and resource-intensive endpoints from abuse
 *          by limiting the number of requests per time window. Uses an in-memory
 *          sliding window algorithm with automatic cleanup of expired entries.
 *          Includes LRU eviction to prevent unbounded memory growth.
 * 
 * @limitations
 * - In-memory storage resets on server restart
 * - Per-instance rate limiting (not shared across multiple Next.js instances)
 * - For production multi-instance deployments, consider implementing Redis-based
 *   rate limiting. See TODO below for implementation guidance.
 * 
 * @todo Redis Support for Multi-Instance Deployments
 * For production environments with multiple Next.js instances, implement Redis-based
 * rate limiting:
 * 1. Create a RedisRateLimiter class that uses Redis sorted sets (ZSET) for sliding window
 * 2. Use Redis commands: ZADD, ZREMRANGEBYSCORE, ZCARD for rate limit checks
 * 3. Add environment variable REDIS_URL to enable Redis mode
 * 4. Fall back to in-memory limiter if Redis is unavailable
 * 5. Example: const limiter = REDIS_URL ? new RedisRateLimiter(REDIS_URL) : getRateLimiter()
 * 
 * @relatedFiles
 * - middleware.ts (applies rate limiting to routes)
 * - src/lib/api-utils.ts (rate limit error response helper)
 * - docs/security/security-overview.md (security documentation)
 */

/**
 * Rate limit configuration for a specific endpoint pattern
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of remaining requests in the current window */
  remaining: number
  /** Timestamp when the rate limit resets (milliseconds since epoch) */
  resetAt: number
  /** Seconds until the rate limit resets (for Retry-After header) */
  retryAfterSeconds: number
}

/**
 * Internal structure for tracking request timestamps
 */
interface RequestRecord {
  /** Timestamps of requests within the current window */
  timestamps: number[]
}

/**
 * Pre-configured rate limit configurations for common endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  /** Login endpoint: 5 requests per 15 minutes */
  LOGIN: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  /** Registration endpoint: 10 requests per hour */
  REGISTER: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  /** Event ingestion: 10 requests per minute */
  INGEST: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Event discovery: 20 requests per minute */
  DISCOVER: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
} as const satisfies Record<string, RateLimitConfig>

/**
 * Maximum number of entries in the rate limiter store
 * When exceeded, oldest entries are evicted (LRU)
 */
const MAX_STORE_SIZE = 10000

/**
 * In-memory rate limiter using sliding window algorithm
 * 
 * Uses a Map to store request timestamps per key (typically IP + route).
 * Implements sliding window by keeping track of individual request timestamps
 * and counting only those within the current window.
 * 
 * Includes LRU eviction to prevent unbounded memory growth.
 * 
 * @example
 * ```typescript
 * const limiter = new RateLimiter()
 * const result = limiter.check("192.168.1.1:/api/v1/auth/login", RATE_LIMIT_CONFIGS.LOGIN)
 * if (!result.allowed) {
 *   return new Response("Too many requests", {
 *     status: 429,
 *     headers: { "Retry-After": String(result.retryAfterSeconds) }
 *   })
 * }
 * ```
 */
export class RateLimiter {
  private store: Map<string, RequestRecord> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  // Track access order for LRU eviction
  private accessOrder: string[] = []

  constructor() {
    // Start automatic cleanup every 5 minutes
    this.startCleanup()
  }

  /**
   * Evict oldest entries if store exceeds maximum size (LRU)
   */
  private evictIfNeeded(): void {
    if (this.store.size <= MAX_STORE_SIZE) {
      return
    }

    // Remove oldest entries (those accessed least recently)
    const entriesToRemove = this.store.size - MAX_STORE_SIZE
    for (let i = 0; i < entriesToRemove; i++) {
      const oldestKey = this.accessOrder.shift()
      if (oldestKey) {
        this.store.delete(oldestKey)
      }
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove key from current position if it exists
    const index = this.accessOrder.indexOf(key)
    if (index !== -1) {
      this.accessOrder.splice(index, 1)
    }
    // Add to end (most recently used)
    this.accessOrder.push(key)
  }

  /**
   * Check if a request is allowed under the rate limit
   * 
   * @param key - Unique identifier for the rate limit bucket (e.g., IP + route)
   * @param config - Rate limit configuration
   * @returns Rate limit result with allowed status and metadata
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const windowStart = now - config.windowMs

    // Get or create record for this key
    let record = this.store.get(key)
    if (!record) {
      record = { timestamps: [] }
      this.store.set(key, record)
      // Evict if needed when adding new entry
      this.evictIfNeeded()
    }

    // Update access order for LRU tracking
    this.updateAccessOrder(key)

    // Filter out timestamps outside the current window (sliding window)
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart)

    // Calculate remaining requests
    const requestCount = record.timestamps.length
    const remaining = Math.max(0, config.maxRequests - requestCount)

    // Calculate reset time (when the oldest request in window expires)
    const oldestTimestamp = record.timestamps[0] || now
    const resetAt = oldestTimestamp + config.windowMs
    const retryAfterSeconds = Math.ceil((resetAt - now) / 1000)

    // Check if request is allowed
    if (requestCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      }
    }

    // Record this request
    record.timestamps.push(now)

    return {
      allowed: true,
      remaining: remaining - 1, // Subtract 1 for the current request
      resetAt,
      retryAfterSeconds: Math.max(0, retryAfterSeconds),
    }
  }

  /**
   * Reset rate limit for a specific key
   * Useful for testing or manual intervention
   * 
   * @param key - Key to reset
   */
  reset(key: string): void {
    this.store.delete(key)
    // Also remove from access order
    const index = this.accessOrder.indexOf(key)
    if (index !== -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  /**
   * Clear all rate limit records
   * Useful for testing
   */
  clear(): void {
    this.store.clear()
    this.accessOrder = []
  }

  /**
   * Start automatic cleanup of expired entries
   * Runs every 5 minutes to prevent memory leaks
   */
  private startCleanup(): void {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)

    // Ensure interval doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Remove expired entries from the store
   * An entry is expired if all its timestamps are older than the longest window
   */
  private cleanup(): void {
    const now = Date.now()
    // Use the longest window (1 hour for registration) as the cleanup threshold
    const maxWindowMs = RATE_LIMIT_CONFIGS.REGISTER.windowMs
    const cleanupThreshold = now - maxWindowMs

    const keysToRemove: string[] = []

    for (const [key, record] of this.store.entries()) {
      // Remove entries where all timestamps are expired
      const hasValidTimestamps = record.timestamps.some(
        (ts) => ts > cleanupThreshold
      )
      if (!hasValidTimestamps) {
        keysToRemove.push(key)
      }
    }

    // Remove expired entries
    for (const key of keysToRemove) {
      this.store.delete(key)
      // Also remove from access order
      const index = this.accessOrder.indexOf(key)
      if (index !== -1) {
        this.accessOrder.splice(index, 1)
      }
    }

    // Also evict if still over limit (defensive)
    this.evictIfNeeded()
  }

  /**
   * Stop the cleanup interval
   * Call this when shutting down the application
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get the current size of the store (for monitoring)
   */
  get size(): number {
    return this.store.size
  }
}

// Singleton instance for use across the application
// Note: In Next.js, this may be recreated on hot reload in development
let rateLimiterInstance: RateLimiter | null = null

/**
 * Get the singleton rate limiter instance
 * Creates the instance on first call
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter()
  }
  return rateLimiterInstance
}

/**
 * Generate a rate limit key from IP and path
 * 
 * @param ip - Client IP address
 * @param path - Request path
 * @returns Combined key for rate limiting
 */
export function generateRateLimitKey(ip: string, path: string): string {
  return `${ip}:${path}`
}

/**
 * Get rate limit config for a given path
 * Returns null if the path should not be rate limited
 * 
 * @param pathname - Request pathname
 * @returns Rate limit config or null
 */
export function getRateLimitConfigForPath(
  pathname: string
): RateLimitConfig | null {
  // Auth endpoints
  if (pathname === "/api/v1/auth/login") {
    return RATE_LIMIT_CONFIGS.LOGIN
  }
  if (pathname === "/api/v1/auth/register") {
    return RATE_LIMIT_CONFIGS.REGISTER
  }

  // Ingestion endpoints (match pattern /api/v1/events/*/ingest)
  if (pathname.match(/^\/api\/v1\/events\/[^/]+\/ingest$/)) {
    return RATE_LIMIT_CONFIGS.INGEST
  }
  if (pathname === "/api/v1/events/ingest") {
    return RATE_LIMIT_CONFIGS.INGEST
  }

  // Discovery endpoint
  if (pathname === "/api/v1/events/discover") {
    return RATE_LIMIT_CONFIGS.DISCOVER
  }

  return null
}

/**
 * Result type for checkRateLimit function used by API routes
 */
export interface CheckRateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Timestamp when the rate limit resets (for error response) */
  resetTime?: number
  /** Seconds until the rate limit resets (for Retry-After header) */
  retryAfterSeconds?: number
}

/**
 * Get client IP address from request headers
 * Handles various proxy configurations (X-Forwarded-For, X-Real-IP)
 */
function getClientIpFromRequest(request: Request): string {
  const headers = request.headers
  
  // Check X-Forwarded-For header (may contain multiple IPs)
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) {
    // Take the first IP (original client)
    const ips = forwardedFor.split(",").map((ip) => ip.trim())
    if (ips[0]) {
      return ips[0]
    }
  }

  // Check X-Real-IP header
  const realIp = headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  // Fallback
  return "unknown"
}

/**
 * Check rate limit for an API request
 * Used by API route handlers for inline rate limiting
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns Rate limit check result with allowed status
 * 
 * @example
 * ```typescript
 * const rateLimitResult = checkRateLimit(request, RATE_LIMITS.auth)
 * if (!rateLimitResult.allowed) {
 *   return errorResponse("RATE_LIMIT_EXCEEDED", "Too many requests", { resetTime: rateLimitResult.resetTime }, 429)
 * }
 * ```
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): CheckRateLimitResult {
  const ip = getClientIpFromRequest(request)
  const url = new URL(request.url)
  const key = generateRateLimitKey(ip, url.pathname)
  
  const limiter = getRateLimiter()
  const result = limiter.check(key, config)
  
  return {
    allowed: result.allowed,
    resetTime: result.allowed ? undefined : result.resetAt,
    retryAfterSeconds: result.allowed ? undefined : result.retryAfterSeconds,
  }
}

/**
 * Alias for RATE_LIMIT_CONFIGS for API route usage
 * Provides semantic naming for different endpoint categories
 */
export const RATE_LIMITS = {
  /** Rate limit for authentication endpoints (login, register) */
  auth: RATE_LIMIT_CONFIGS.LOGIN,
  /** Rate limit for ingestion endpoints */
  ingestion: RATE_LIMIT_CONFIGS.INGEST,
  /** Rate limit for discovery endpoints */
  discovery: RATE_LIMIT_CONFIGS.DISCOVER,
} as const
