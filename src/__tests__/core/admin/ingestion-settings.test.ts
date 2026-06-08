/**
 * @fileoverview Tests for admin ingestion settings core (app-scoped resolution)
 */

import { describe, it, expect, afterEach } from "vitest"
import { getAppSettingPreview } from "@/core/admin/ingestion-settings"

describe("ingestion-settings core", () => {
  const originalServiceUrl = process.env.INGESTION_SERVICE_URL
  const originalPort = process.env.INGESTION_PORT

  afterEach(() => {
    if (originalServiceUrl === undefined) {
      delete process.env.INGESTION_SERVICE_URL
    } else {
      process.env.INGESTION_SERVICE_URL = originalServiceUrl
    }
    if (originalPort === undefined) {
      delete process.env.INGESTION_PORT
    } else {
      process.env.INGESTION_PORT = originalPort
    }
  })

  it("resolves app-scoped INGESTION_SERVICE_URL from environment", () => {
    process.env.INGESTION_SERVICE_URL = "http://custom-ingestion:9000"
    const setting = getAppSettingPreview("INGESTION_SERVICE_URL")
    expect(setting?.effectiveValue).toBe("http://custom-ingestion:9000")
    expect(setting?.source).toBe("environment")
  })

  it("falls back to registry default for app-scoped keys when env unset", () => {
    delete process.env.INGESTION_PORT
    const setting = getAppSettingPreview("INGESTION_PORT")
    expect(setting?.effectiveValue).toBe(8000)
    expect(setting?.source).toBe("default")
  })
})
