/**
 * @fileoverview Tests for site policy merge helpers
 */

import { describe, expect, it } from "vitest"
import { mergeSitePolicy } from "@/core/admin/site-policy-merge"

const basePolicy = {
  killSwitchEnv: "MRE_SCRAPE_ENABLED",
  hosts: [
    {
      pattern: "live.liverc.com",
      crawlDelaySeconds: 0.1,
      maxConcurrency: 8,
      respectRobots: true,
      conditionalRequests: true,
    },
    {
      pattern: "*.liverc.com",
      crawlDelaySeconds: 0.1,
      maxConcurrency: 8,
      respectRobots: true,
      conditionalRequests: true,
    },
  ],
}

describe("mergeSitePolicy", () => {
  it("preserves base hosts when override is partial", () => {
    const merged = mergeSitePolicy(basePolicy, {
      hosts: [{ pattern: "live.liverc.com", crawlDelaySeconds: 0.5 }],
    })

    expect(merged.hosts).toHaveLength(2)
    expect(merged.hosts?.[0]).toMatchObject({
      pattern: "live.liverc.com",
      crawlDelaySeconds: 0.5,
      maxConcurrency: 8,
    })
    expect(merged.hosts?.[1]?.pattern).toBe("*.liverc.com")
  })

  it("appends new host patterns from overrides", () => {
    const merged = mergeSitePolicy(basePolicy, {
      hosts: [{ pattern: "example.com", crawlDelaySeconds: 1, maxConcurrency: 2 }],
    })

    expect(merged.hosts).toHaveLength(3)
    expect(merged.hosts?.[2]?.pattern).toBe("example.com")
  })
})
