import { describe, expect, it } from "vitest"
import { coerceParquetNumber } from "@/core/telemetry/telemetry-parquet-coerce"

describe("coerceParquetNumber", () => {
  it("accepts finite numbers", () => {
    expect(coerceParquetNumber(-35.33)).toBe(-35.33)
    expect(coerceParquetNumber(0)).toBe(0)
  })

  it("coerces bigint (Parquet int64) to number", () => {
    const v = BigInt("1764000000000000000")
    expect(coerceParquetNumber(v)).toBe(1764000000000000000)
  })

  it("rejects non-numeric values", () => {
    expect(coerceParquetNumber(null)).toBeNull()
    expect(coerceParquetNumber(undefined)).toBeNull()
    expect(coerceParquetNumber("1")).toBeNull()
    expect(coerceParquetNumber(NaN)).toBeNull()
    expect(coerceParquetNumber(Number.POSITIVE_INFINITY)).toBeNull()
  })
})
