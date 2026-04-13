import { describe, expect, it } from "vitest"
import {
  buildTelemetryComparePayload,
  parseCompareSessionIdsParam,
} from "@/core/telemetry/telemetry-compare"

describe("parseCompareSessionIdsParam", () => {
  it("parses 2–4 UUIDs", () => {
    const a = "11111111-1111-4111-8111-111111111111"
    const b = "22222222-2222-4222-8222-222222222222"
    expect(parseCompareSessionIdsParam(`${a},${b}`)).toEqual([a, b])
  })

  it("returns null for invalid input", () => {
    expect(parseCompareSessionIdsParam(null)).toBeNull()
    expect(parseCompareSessionIdsParam("only-one")).toBeNull()
  })
})

describe("buildTelemetryComparePayload", () => {
  it("computes best lap from valid laps", () => {
    const a = "11111111-1111-4111-8111-111111111111"
    const payload = buildTelemetryComparePayload([
      {
        id: a,
        name: "S1",
        status: "ready",
        track: { trackName: "T" },
        currentRunId: "run-1",
        laps: [
          { lapNumber: 1, durationMs: 120_000, validity: "OUTLAP", runId: "run-1" },
          { lapNumber: 2, durationMs: 90_000, validity: "VALID", runId: "run-1" },
        ],
      },
    ])
    expect(payload.sessions[0].bestLapMs).toBe(90_000)
    expect(payload.sessions[0].lapCount).toBe(2)
  })
})
