/**
 * @fileoverview Tests for authentication utilities
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for isPublicApi function and public API prefix configuration
 */

import { describe, it, expect } from "vitest"
import { isPublicApi, publicApiPrefixes } from "@/lib/auth"

describe("isPublicApi", () => {
  describe("public API endpoints", () => {
    it("should return true for /api/health", () => {
      expect(isPublicApi("/api/health")).toBe(true)
    })

    it("should return true for /api/v1/auth/login", () => {
      expect(isPublicApi("/api/v1/auth/login")).toBe(true)
    })

    it("should return true for /api/v1/auth/register", () => {
      expect(isPublicApi("/api/v1/auth/register")).toBe(true)
    })

    it("should return true for paths starting with public prefixes", () => {
      expect(isPublicApi("/api/health/check")).toBe(true)
      expect(isPublicApi("/api/v1/auth/login/validate")).toBe(true)
    })
  })

  describe("protected API endpoints", () => {
    it("should return false for /api/v1/events", () => {
      expect(isPublicApi("/api/v1/events")).toBe(false)
    })

    it("should return false for /api/v1/admin/stats", () => {
      expect(isPublicApi("/api/v1/admin/stats")).toBe(false)
    })

    it("should return false for /api/v1/tracks", () => {
      expect(isPublicApi("/api/v1/tracks")).toBe(false)
    })

    it("should return false for non-API routes", () => {
      expect(isPublicApi("/dashboard")).toBe(false)
      expect(isPublicApi("/admin")).toBe(false)
      expect(isPublicApi("/login")).toBe(false)
    })
  })

  describe("publicApiPrefixes configuration", () => {
    it("should include /api/health", () => {
      expect(publicApiPrefixes).toContain("/api/health")
    })

    it("should include /api/v1/auth/login", () => {
      expect(publicApiPrefixes).toContain("/api/v1/auth/login")
    })

    it("should include /api/v1/auth/register", () => {
      expect(publicApiPrefixes).toContain("/api/v1/auth/register")
    })

    it("should maintain synchronization with isPublicApi logic", () => {
      // Verify that all prefixes in publicApiPrefixes are recognized by isPublicApi
      publicApiPrefixes.forEach((prefix) => {
        expect(isPublicApi(prefix)).toBe(true)
      })
    })
  })
})
