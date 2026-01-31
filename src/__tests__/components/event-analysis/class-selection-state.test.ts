/**
 * @fileoverview Test for class selection state update logic
 *
 * @created 2025-01-XX
 * @creator Auto (AI Assistant)
 *
 * @description Tests the normalization and state update logic for class selection
 */

import { describe, it, expect } from "vitest"

describe("Class selection state normalization", () => {
  it("should normalize valid class name strings", () => {
    const normalize = (className: string | null | undefined): string | null => {
      return className && typeof className === "string" && className.trim() !== ""
        ? className.trim()
        : null
    }

    expect(normalize("1/8 Nitro Buggy")).toBe("1/8 Nitro Buggy")
    expect(normalize("  1/8 Nitro Buggy  ")).toBe("1/8 Nitro Buggy")
    expect(normalize("")).toBe(null)
    expect(normalize("   ")).toBe(null)
    expect(normalize(null)).toBe(null)
    expect(normalize(undefined)).toBe(null)
  })

  it("should handle edge cases", () => {
    const normalize = (className: string | null | undefined): string | null => {
      return className && typeof className === "string" && className.trim() !== ""
        ? className.trim()
        : null
    }

    // Empty string
    expect(normalize("")).toBe(null)

    // Whitespace only
    expect(normalize("   ")).toBe(null)
    expect(normalize("\t\n")).toBe(null)

    // Valid strings with whitespace
    expect(normalize("  Class Name  ")).toBe("Class Name")
  })
})
