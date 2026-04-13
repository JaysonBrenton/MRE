import { describe, expect, it } from "vitest"
import { telemetryFailureUserMessage } from "@/core/telemetry/telemetry-failure-messages"

describe("telemetryFailureUserMessage", () => {
  it("maps known CSV_NO_TIME_COLUMN", () => {
    expect(telemetryFailureUserMessage("CSV_NO_TIME_COLUMN")).toMatch(/time column/i)
  })

  it("maps known NMEA_NO_FIX", () => {
    expect(telemetryFailureUserMessage("NMEA_NO_FIX")).toMatch(/NMEA|position|fix/i)
  })

  it("maps PARSE_RAW_FAILED to a user-safe message", () => {
    const msg = telemetryFailureUserMessage("PARSE_RAW_FAILED", "TypeError: boom")
    expect(msg).toMatch(/couldn't process/i)
    expect(msg).not.toContain("TypeError")
  })

  it("maps PARSE_RAW_FAILED with ClickHouse detail to cache connection message", () => {
    const msg = telemetryFailureUserMessage(
      "PARSE_RAW_FAILED",
      "DatabaseError: ... (AUTHENTICATION_FAILED) ... http://mre-clickhouse:8123"
    )
    expect(msg).toMatch(/ClickHouse|cache/i)
    expect(msg).not.toContain("mre-clickhouse")
  })

  it("falls back unknown detail when code is missing", () => {
    expect(telemetryFailureUserMessage(null, "Operator note")).toBe("Operator note")
  })
})
