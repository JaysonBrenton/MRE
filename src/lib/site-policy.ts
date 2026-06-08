// @fileoverview Shared scraping policy helpers for the Next.js app
//
// Loads the same JSON policy used by the Python ingestion service to enforce
// kill switches and promote consistent error messaging before making calls to
// the ingestion microservice.

import {
  getRuntimeEffectiveValue,
  isRuntimeCacheWarm,
  refreshRuntimeSettingsCache,
} from "@/core/admin/ingestion-settings-runtime"
import {
  loadBaseSitePolicy,
  mergeSitePolicy,
  parseSitePolicyOverrides,
  type SitePolicyConfig,
} from "@/core/admin/site-policy-merge"

function resolveSitePolicyConfig(): SitePolicyConfig {
  const base = loadBaseSitePolicy()
  if (!isRuntimeCacheWarm()) {
    return base
  }

  const overridesRaw = getRuntimeEffectiveValue("site_policy_overrides")
  if (overridesRaw === undefined || overridesRaw === "{}" || overridesRaw === "") {
    return base
  }

  try {
    const overrides = parseSitePolicyOverrides(overridesRaw)
    return mergeSitePolicy(base, overrides)
  } catch {
    return base
  }
}

function killSwitchEnvName(): string {
  return resolveSitePolicyConfig().killSwitchEnv || "MRE_SCRAPE_ENABLED"
}

function isDisabledFlagValue(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no"
}

export function isScrapingEnabled(): boolean {
  if (typeof process === "undefined" || !process.env) {
    return true
  }

  const killSwitchEnv = killSwitchEnvName()

  if (isRuntimeCacheWarm()) {
    const cached = getRuntimeEffectiveValue(killSwitchEnv)
    if (cached !== undefined) {
      return !isDisabledFlagValue(String(cached))
    }
  }

  return !isDisabledFlagValue(process.env[killSwitchEnv])
}

export async function assertScrapingEnabled(): Promise<void> {
  await refreshRuntimeSettingsCache()
  if (!isScrapingEnabled()) {
    throw new Error(
      "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
    )
  }
}

export async function getSitePolicyConfig(): Promise<SitePolicyConfig> {
  await refreshRuntimeSettingsCache()
  return resolveSitePolicyConfig()
}
