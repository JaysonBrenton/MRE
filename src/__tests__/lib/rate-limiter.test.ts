/**
 * @fileoverview Tests for rate limiter
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Tests for the in-memory rate limiter implementation
 * 
 * @purpose Validates rate limiter behavior including:
 *          - Request counting and limiting
 *          - Sliding window behavior
 *          - Key generation
 *          - Config lookup for paths
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  RateLimiter,
  RATE_LIMIT_CONFIGS,
  generateRateLimitKey,
  getRateLimitConfigForPath,
} from "@/lib/rate-limiter"

describe("RateLimiter", () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter()
  })

  afterEach(() => {
    limiter.destroy()
  })

  describe("check", () => {
    it("should allow requests under the limit", () => {
      const config = { maxRequests: 5, windowMs: 60000 }
      const key = "test-key"

      for (let i = 0; i < 5; i++) {
        const result = limiter.check(key, config)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4 - i)
      }
    })

    it("should block requests over the limit", () => {
      const config = { maxRequests: 3, windowMs: 60000 }
      const key = "test-key"

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const result = limiter.check(key, config)
        expect(result.allowed).toBe(true)
      }

      // 4th request should be blocked
      const result = limiter.check(key, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
    })

    it("should track different keys separately", () => {
      const config = { maxRequests: 2, windowMs: 60000 }

      // Exhaust limit for key1
      limiter.check("key1", config)
      limiter.check("key1", config)
      const key1Result = limiter.check("key1", config)
      expect(key1Result.allowed).toBe(false)

      // key2 should still be allowed
      const key2Result = limiter.check("key2", config)
      expect(key2Result.allowed).toBe(true)
    })

    it("should reset after window expires", async () => {
      vi.useFakeTimers()
      const config = { maxRequests: 2, windowMs: 1000 } // 1 second window
      const key = "test-key"

      // Exhaust limit
      limiter.check(key, config)
      limiter.check(key, config)
      let result = limiter.check(key, config)
      expect(result.allowed).toBe(false)

      // Advance time past the window
      vi.advanceTimersByTime(1100)

      // Should be allowed again
      result = limiter.check(key, config)
      expect(result.allowed).toBe(true)

      vi.useRealTimers()
    })

    it("should implement sliding window correctly", async () => {
      vi.useFakeTimers()
      const config = { maxRequests: 3, windowMs: 1000 } // 1 second window
      const key = "test-key"

      // Make 2 requests at t=0
      limiter.check(key, config)
      limiter.check(key, config)

      // Advance 500ms
      vi.advanceTimersByTime(500)

      // Make 1 more request at t=500
      limiter.check(key, config)

      // Should be blocked (3 requests in last 1000ms)
      let result = limiter.check(key, config)
      expect(result.allowed).toBe(false)

      // Advance 600ms (t=1100) - first 2 requests should expire
      vi.advanceTimersByTime(600)

      // Should be allowed (only 1 request in last 1000ms)
      result = limiter.check(key, config)
      expect(result.allowed).toBe(true)

      vi.useRealTimers()
    })

    it("should return correct retryAfterSeconds", () => {
      const config = { maxRequests: 1, windowMs: 60000 } // 60 second window
      const key = "test-key"

      limiter.check(key, config)
      const result = limiter.check(key, config)

      expect(result.allowed).toBe(false)
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(60)
    })
  })

  describe("reset", () => {
    it("should reset rate limit for a specific key", () => {
      const config = { maxRequests: 1, windowMs: 60000 }
      const key = "test-key"

      limiter.check(key, config)
      let result = limiter.check(key, config)
      expect(result.allowed).toBe(false)

      limiter.reset(key)

      result = limiter.check(key, config)
      expect(result.allowed).toBe(true)
    })
  })

  describe("clear", () => {
    it("should clear all rate limit records", () => {
      const config = { maxRequests: 1, windowMs: 60000 }

      limiter.check("key1", config)
      limiter.check("key2", config)

      expect(limiter.size).toBe(2)

      limiter.clear()

      expect(limiter.size).toBe(0)
    })
  })

  describe("size", () => {
    it("should return the number of tracked keys", () => {
      const config = { maxRequests: 5, windowMs: 60000 }

      expect(limiter.size).toBe(0)

      limiter.check("key1", config)
      expect(limiter.size).toBe(1)

      limiter.check("key2", config)
      expect(limiter.size).toBe(2)

      limiter.check("key1", config) // Same key
      expect(limiter.size).toBe(2)
    })
  })
})

describe("generateRateLimitKey", () => {
  it("should combine IP and path", () => {
    const key = generateRateLimitKey("192.168.1.1", "/api/v1/auth/login")
    expect(key).toBe("192.168.1.1:/api/v1/auth/login")
  })

  it("should handle IPv6 addresses", () => {
    const key = generateRateLimitKey("::1", "/api/v1/auth/login")
    expect(key).toBe("::1:/api/v1/auth/login")
  })

  it("should handle unknown IP", () => {
    const key = generateRateLimitKey("unknown", "/api/v1/auth/login")
    expect(key).toBe("unknown:/api/v1/auth/login")
  })
})

describe("getRateLimitConfigForPath", () => {
  it("should return LOGIN config for /api/v1/auth/login", () => {
    const config = getRateLimitConfigForPath("/api/v1/auth/login")
    expect(config).toEqual(RATE_LIMIT_CONFIGS.LOGIN)
  })

  it("should return REGISTER config for /api/v1/auth/register", () => {
    const config = getRateLimitConfigForPath("/api/v1/auth/register")
    expect(config).toEqual(RATE_LIMIT_CONFIGS.REGISTER)
  })

  it("should return INGEST config for /api/v1/events/{id}/ingest", () => {
    const config = getRateLimitConfigForPath("/api/v1/events/123-456/ingest")
    expect(config).toEqual(RATE_LIMIT_CONFIGS.INGEST)
  })

  it("should return INGEST config for /api/v1/events/ingest", () => {
    const config = getRateLimitConfigForPath("/api/v1/events/ingest")
    expect(config).toEqual(RATE_LIMIT_CONFIGS.INGEST)
  })

  it("should return DISCOVER config for /api/v1/events/discover", () => {
    const config = getRateLimitConfigForPath("/api/v1/events/discover")
    expect(config).toEqual(RATE_LIMIT_CONFIGS.DISCOVER)
  })

  it("should return null for non-rate-limited paths", () => {
    expect(getRateLimitConfigForPath("/api/v1/tracks")).toBeNull()
    expect(getRateLimitConfigForPath("/api/v1/events/search")).toBeNull()
    expect(getRateLimitConfigForPath("/api/health")).toBeNull()
    expect(getRateLimitConfigForPath("/welcome")).toBeNull()
  })
})

describe("RATE_LIMIT_CONFIGS", () => {
  it("should have correct LOGIN config", () => {
    expect(RATE_LIMIT_CONFIGS.LOGIN).toEqual({
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    })
  })

  it("should have correct REGISTER config", () => {
    expect(RATE_LIMIT_CONFIGS.REGISTER).toEqual({
      maxRequests: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    })
  })

  it("should have correct INGEST config", () => {
    expect(RATE_LIMIT_CONFIGS.INGEST).toEqual({
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
    })
  })

  it("should have correct DISCOVER config", () => {
    expect(RATE_LIMIT_CONFIGS.DISCOVER).toEqual({
      maxRequests: 20,
      windowMs: 60 * 1000, // 1 minute
    })
  })
})

