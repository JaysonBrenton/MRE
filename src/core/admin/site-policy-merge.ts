/**
 * @fileoverview Merge base site policy JSON with DB/runtime overrides
 */

import { readFileSync } from "fs"
import { join } from "path"

export interface SitePolicyHostRule {
  pattern: string
  crawlDelaySeconds?: number
  maxConcurrency?: number
  respectRobots?: boolean
  conditionalRequests?: boolean
}

export interface SitePolicyConfig {
  killSwitchEnv?: string
  hosts?: SitePolicyHostRule[]
  [key: string]: unknown
}

function mergeHostRules(
  baseHosts: SitePolicyHostRule[],
  overrideHosts: SitePolicyHostRule[]
): SitePolicyHostRule[] {
  const byPattern = new Map<string, SitePolicyHostRule>()
  const order: string[] = []

  for (const host of baseHosts) {
    if (!host.pattern) continue
    byPattern.set(host.pattern, { ...host })
    order.push(host.pattern)
  }

  for (const override of overrideHosts) {
    if (!override.pattern) continue
    const existing = byPattern.get(override.pattern)
    if (existing) {
      byPattern.set(override.pattern, { ...existing, ...override })
    } else {
      byPattern.set(override.pattern, { ...override })
      order.push(override.pattern)
    }
  }

  return order.map((pattern) => byPattern.get(pattern)).filter(Boolean) as SitePolicyHostRule[]
}

export function mergeSitePolicy(
  base: SitePolicyConfig,
  overrides: SitePolicyConfig | null | undefined
): SitePolicyConfig {
  if (!overrides || Object.keys(overrides).length === 0) {
    return structuredClone(base)
  }

  const merged: SitePolicyConfig = structuredClone(base)
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "hosts" && Array.isArray(value)) {
      const baseHosts = Array.isArray(merged.hosts) ? merged.hosts : []
      merged.hosts = mergeHostRules(baseHosts, value as SitePolicyHostRule[])
    } else if (value !== undefined && value !== null) {
      merged[key] = structuredClone(value)
    }
  }
  return merged
}

export function loadBaseSitePolicy(): SitePolicyConfig {
  const policyPath = join(process.cwd(), "policies", "site_policy", "policy.json")
  const raw = readFileSync(policyPath, "utf-8")
  return JSON.parse(raw) as SitePolicyConfig
}

export function parseSitePolicyOverrides(raw: unknown): SitePolicyConfig {
  if (raw === undefined || raw === null || raw === "") {
    return {}
  }
  const text = typeof raw === "string" ? raw : JSON.stringify(raw)
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("site_policy_overrides must be a JSON object")
  }
  return parsed as SitePolicyConfig
}

export function validateSitePolicyOverrides(raw: unknown): string | null {
  try {
    const parsed = parseSitePolicyOverrides(raw)
    if (parsed.hosts !== undefined) {
      if (!Array.isArray(parsed.hosts)) {
        return "hosts must be an array"
      }
      for (const host of parsed.hosts) {
        if (!host || typeof host !== "object") {
          return "each host rule must be an object"
        }
        if (typeof (host as SitePolicyHostRule).pattern !== "string") {
          return "each host rule must include a pattern string"
        }
      }
    }
    return null
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON"
  }
}
