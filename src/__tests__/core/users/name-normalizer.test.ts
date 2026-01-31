/**
 * @fileoverview Tests for driver name normalization utility
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Tests normalization consistency with Python implementation
 */

import { describe, it, expect } from "vitest"
import { normalizeDriverName } from "@/core/users/name-normalizer"

describe("normalizeDriverName", () => {
  it("should normalize basic names: lowercase, trim, collapse whitespace", () => {
    expect(normalizeDriverName("JOHN DOE")).toBe("doe john")
    expect(normalizeDriverName("  john   doe  ")).toBe("doe john")
    expect(normalizeDriverName("John\tDoe\nSmith")).toBe("doe john smith")
  })

  it("should strip punctuation", () => {
    expect(normalizeDriverName("John O'Brien")).toBe("john obrien")
    expect(normalizeDriverName("Mary-Jane Watson")).toBe("mary jane watson")
    expect(normalizeDriverName("Bob & Alice")).toBe("alice and bob")
  })

  it("should replace & with 'and'", () => {
    expect(normalizeDriverName("Smith & Co")).toBe("and co smith")
    expect(normalizeDriverName("A & B Racing")).toBe("a and b racing")
  })

  it("should remove common noise tokens", () => {
    expect(normalizeDriverName("John Doe RC")).toBe("doe john")
    expect(normalizeDriverName("Jane Smith Raceway")).toBe("jane smith")
    expect(normalizeDriverName("Bob Team")).toBe("bob")
    expect(normalizeDriverName("Alice Club")).toBe("alice")
    expect(normalizeDriverName("Charlie Inc")).toBe("charlie")
    expect(normalizeDriverName("John RC Team")).toBe("john")
  })

  it("should sort tokens for multi-word names", () => {
    expect(normalizeDriverName("Smith John")).toBe("john smith")
    expect(normalizeDriverName("John Smith")).toBe("john smith")
    expect(normalizeDriverName("Mary Jane Watson")).toBe("jane mary watson")
  })

  it("should handle empty and null values", () => {
    expect(normalizeDriverName("")).toBe("")
    expect(normalizeDriverName("   ")).toBe("")
    expect(normalizeDriverName(null)).toBe("")
    expect(normalizeDriverName(undefined)).toBe("")
  })

  it("should handle complex real-world examples", () => {
    // Common variations that should normalize to the same thing
    expect(normalizeDriverName("Jayson Brenton")).toBe("brenton jayson")
    expect(normalizeDriverName("JAYSON BRENTON")).toBe("brenton jayson")
    expect(normalizeDriverName("  Jayson   Brenton  ")).toBe("brenton jayson")
    expect(normalizeDriverName("Jayson-Brenton")).toBe("brenton jayson")

    // With noise tokens
    expect(normalizeDriverName("Jayson Brenton RC")).toBe("brenton jayson")
    expect(normalizeDriverName("Jayson Brenton Team")).toBe("brenton jayson")
  })

  it("should handle single word names", () => {
    expect(normalizeDriverName("Madonna")).toBe("madonna")
    expect(normalizeDriverName("Cher")).toBe("cher")
    expect(normalizeDriverName("Sting")).toBe("sting")
  })

  it("should handle numbers in names", () => {
    expect(normalizeDriverName("John Doe 123")).toBe("123 doe john")
    expect(normalizeDriverName("Driver #5")).toBe("5 driver")
  })
})
