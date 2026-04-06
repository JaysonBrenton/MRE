/**
 * @fileoverview Tests for multi-main class label matching
 */

import { describe, it, expect } from "vitest"
import { multiMainResultMatchesClassFilter } from "@/core/events/multi-main-class-match"

describe("multiMainResultMatchesClassFilter", () => {
  it("returns true when filter is null or empty", () => {
    expect(multiMainResultMatchesClassFilter("1/8 Electric Buggy", null)).toBe(true)
    expect(multiMainResultMatchesClassFilter("1/8 Electric Buggy", undefined)).toBe(true)
    expect(multiMainResultMatchesClassFilter("1/8 Electric Buggy", "")).toBe(true)
    expect(multiMainResultMatchesClassFilter("1/8 Electric Buggy", "   ")).toBe(true)
  })

  it("matches case-insensitively with trim", () => {
    expect(multiMainResultMatchesClassFilter("1/8 Electric Buggy", "1/8 electric buggy")).toBe(true)
    expect(multiMainResultMatchesClassFilter(" 1/8 Electric Buggy ", "1/8 Electric Buggy")).toBe(
      true
    )
  })

  it("returns false when labels differ", () => {
    expect(multiMainResultMatchesClassFilter("1/8 Electric Buggy", "1/10 Open")).toBe(false)
  })
})
