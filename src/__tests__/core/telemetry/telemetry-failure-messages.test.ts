import { describe, expect, it } from "vitest"
import { telemetryFailureUserMessage } from "@/core/telemetry/telemetry-failure-messages"

describe("telemetryFailureUserMessage", () => {
  it("maps known CSV_NO_TIME_COLUMN", () => {
    expect(telemetryFailureUserMessage("CSV_NO_TIME_COLUMN")).toMatch(/time column/i)
  })

  it("maps PARSE_RAW_FAILED to a user-safe message", () => {
    const msg = telemetryFailureUserMessage("PARSE_RAW_FAILED", "TypeError: boom")
    expect(msg).toMatch(/couldn't process/i)
    expect(msg).not.toContain("TypeError")
  })

  it("falls back unknown detail when code is missing", () => {
    expect(telemetryFailureUserMessage(null, "Operator note")).toBe("Operator note")
  })
})
