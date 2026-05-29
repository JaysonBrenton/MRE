/**
 * @fileoverview Tests for useDriverLineColors hook
 */

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDriverLineColors } from "@/hooks/useChartColors"

describe("useDriverLineColors", () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
      length: store.size,
      key: () => null,
    })
  })

  it("persists colors by driver id rather than selection index", () => {
    const defaultColorForDriver = (driverId: string) =>
      driverId === "alpha" ? "#111111" : "#222222"

    const { result, rerender } = renderHook(
      ({ driverIds }) => useDriverLineColors("chart-test", driverIds, defaultColorForDriver),
      { initialProps: { driverIds: ["alpha", "bravo"] } }
    )

    act(() => {
      result.current.setDriverColor("bravo", "#abcdef")
    })

    expect(result.current.colorByDriverId.bravo).toBe("#abcdef")

    rerender({ driverIds: ["bravo", "alpha"] })

    expect(result.current.colorByDriverId.bravo).toBe("#abcdef")
    expect(result.current.colorByDriverId.alpha).toBe("#111111")
  })
})
