/**
 * @fileoverview Tests for ingestion settings registry
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  INGESTION_SETTINGS_REGISTRY,
  getSettingDefinition,
  listAdminVisibleSettings,
  listByCategory,
  listSettingKeys,
  toRegistryParityRecords,
  type RegistryParityRecord,
} from "@/core/admin/ingestion-settings-registry"

const PARITY_FIXTURE_PATH = join(
  process.cwd(),
  "ingestion/tests/fixtures/settings_registry_parity.json"
)

function loadParityFixture(): RegistryParityRecord[] {
  return JSON.parse(readFileSync(PARITY_FIXTURE_PATH, "utf8")) as RegistryParityRecord[]
}

describe("ingestion settings registry", () => {
  it("has unique keys", () => {
    const keys = listSettingKeys()
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("defines 47 settings", () => {
    expect(INGESTION_SETTINGS_REGISTRY).toHaveLength(47)
  })

  it("getSettingDefinition returns known keys and undefined for unknown", () => {
    expect(getSettingDefinition("MRE_SCRAPE_ENABLED")?.type).toBe("boolean")
    expect(getSettingDefinition("NOT_A_SETTING")).toBeUndefined()
  })

  it("derives writable from applyMode", () => {
    const runtime = getSettingDefinition("MRE_SCRAPE_ENABLED")
    const restart = getSettingDefinition("SITE_POLICY_PATH")
    const readonly = getSettingDefinition("DATABASE_URL")

    expect(runtime?.writable).toBe(true)
    expect(restart?.writable).toBe(false)
    expect(readonly?.writable).toBe(false)
  })

  it("listByCategory includes every setting exactly once", () => {
    const grouped = listByCategory()
    const keysFromGroups = grouped.flatMap((group) => group.settings.map((def) => def.key))
    expect(keysFromGroups).toEqual(listSettingKeys())
  })

  it("listAdminVisibleSettings excludes INGESTION_ADMIN_TOKEN", () => {
    const visible = listAdminVisibleSettings()
    expect(visible.some((def) => def.key === "INGESTION_ADMIN_TOKEN")).toBe(false)
    expect(visible).toHaveLength(INGESTION_SETTINGS_REGISTRY.length - 1)
  })

  it("matches committed parity fixture (key, type, default, applyMode, scope, category)", () => {
    const fixture = loadParityFixture()
    expect(toRegistryParityRecords()).toEqual(fixture)
  })
})
