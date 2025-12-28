// @fileoverview Shared scraping policy helpers for the Next.js app
//
// Loads the same JSON policy used by the Python ingestion service to enforce
// kill switches and promote consistent error messaging before making calls to
// the ingestion microservice.

import policy from "../../policies/site_policy/policy.json"

const killSwitchEnv = (policy.killSwitchEnv as string | undefined) || "MRE_SCRAPE_ENABLED"

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
  return !isDisabledFlagValue(process.env[killSwitchEnv])
}

export function assertScrapingEnabled(): void {
  if (!isScrapingEnabled()) {
    throw new Error(
      "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
    )
  }
}
