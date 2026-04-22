import { describe, expect, it } from "vitest"
import { isPlaceholderClass, isSchedulePlaceholderLiveRcRow } from "@/lib/format-class-name"

describe("isPlaceholderClass", () => {
  it("treats LiveRC time-block / break banners as non-classes", () => {
    expect(isPlaceholderClass("**** 15 MIN BREAK ****")).toBe(true)
    expect(isPlaceholderClass("5 minute break")).toBe(true)
  })

  it("leaves real class names alone", () => {
    expect(isPlaceholderClass("1/8 EP Buggy")).toBe(false)
  })
})

describe("isSchedulePlaceholderLiveRcRow", () => {
  it("flags break text in className or raceLabel", () => {
    expect(isSchedulePlaceholderLiveRcRow("**** 15 MIN BREAK ****", "1/8 Buggy — A Main")).toBe(
      true
    )
    expect(isSchedulePlaceholderLiveRcRow("1/8 EP Buggy", "**** 15 MIN BREAK ****")).toBe(true)
  })

  it("does not flag a normal session", () => {
    expect(isSchedulePlaceholderLiveRcRow("1/8 EP Buggy", "1/8 EP Buggy — A Main")).toBe(false)
  })
})
