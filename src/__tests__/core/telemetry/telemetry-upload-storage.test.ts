import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  absolutePathFromStoragePath,
  buildTelemetryStorageRelativePath,
} from "@/core/telemetry/telemetry-upload-storage"

describe("telemetry-upload-storage", () => {
  beforeEach(() => {
    process.env.TELEMETRY_UPLOAD_ROOT = "/data/telemetry"
  })
  afterEach(() => {
    delete process.env.TELEMETRY_UPLOAD_ROOT
  })

  it("builds posix relative storage keys", () => {
    const p = buildTelemetryStorageRelativePath("user-1", "art-2")
    expect(p).toBe("uploads/user-1/art-2")
  })

  it("rejects path traversal outside upload root", () => {
    expect(() => absolutePathFromStoragePath("../../../etc/passwd")).toThrow(/upload root/)
  })
})
