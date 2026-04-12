import { describe, expect, it } from "vitest"
import {
  decodeTelemetryListCursor,
  resolveDatasetParquetRelativePath,
} from "@/core/telemetry/telemetry-repo"

describe("decodeTelemetryListCursor", () => {
  it("round-trips", () => {
    const raw = Buffer.from(
      JSON.stringify({ createdAt: "2026-01-01T00:00:00.000Z", id: "abc-uuid" }),
      "utf8"
    ).toString("base64url")
    expect(decodeTelemetryListCursor(raw)).toEqual({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "abc-uuid",
    })
  })

  it("returns null for invalid cursor", () => {
    expect(decodeTelemetryListCursor("not-valid")).toBeNull()
  })
})

describe("resolveDatasetParquetRelativePath", () => {
  const datasetId = "d1111111-1111-1111-1111-111111111111"

  it("returns path when dataset id appears in path", () => {
    const path = `canonical/sess/run/${datasetId}/gnss_pvt.parquet`
    expect(
      resolveDatasetParquetRelativePath({
        datasetId,
        qualitySummary: { parquetRelativePath: path },
        outputDatasetIds: [datasetId],
      })
    ).toBe(path)
  })

  it("returns path when single output id matches", () => {
    const path = "canonical/sess/run/d1111111-1111-1111-1111-111111111111/gnss_pvt.parquet"
    expect(
      resolveDatasetParquetRelativePath({
        datasetId,
        qualitySummary: { parquetRelativePath: path },
        outputDatasetIds: [datasetId],
      })
    ).toBe(path)
  })

  it("returns null when output ids do not match", () => {
    expect(
      resolveDatasetParquetRelativePath({
        datasetId,
        qualitySummary: { parquetRelativePath: "canonical/other/path.parquet" },
        outputDatasetIds: ["other-id"],
      })
    ).toBeNull()
  })
})
