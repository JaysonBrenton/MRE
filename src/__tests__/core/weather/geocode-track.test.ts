/**
 * @fileoverview Tests for geocodeTrack — mocks Node `https` module (implementation uses `https.request`, not `fetch`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "events"
import type { IncomingMessage } from "http"

const { mockHttpsRequest } = vi.hoisted(() => ({
  mockHttpsRequest: vi.fn(),
}))

vi.mock("https", () => ({
  request: mockHttpsRequest,
}))

import { geocodeTrack, __resetGeocodeTestState } from "@/core/weather/geocode-track"

function successJson(body: unknown, statusCode = 200) {
  mockHttpsRequest.mockImplementation(
    (options: unknown, callback: (res: IncomingMessage) => void) => {
      const res = new EventEmitter() as IncomingMessage & { statusCode?: number }
      res.statusCode = statusCode
      callback(res as IncomingMessage)
      queueMicrotask(() => {
        res.emit("data", Buffer.from(JSON.stringify(body)))
        res.emit("end")
      })
      const req = new EventEmitter()
      return Object.assign(req, {
        end: vi.fn(),
        setTimeout: vi.fn(),
        destroy: vi.fn(),
      })
    }
  )
}

describe("geocodeTrack", () => {
  beforeEach(() => {
    __resetGeocodeTestState()
    vi.clearAllMocks()
    successJson([
      {
        lat: "-35.2809",
        lon: "149.1300",
        display_name: "Canberra, Australian Capital Territory, Australia",
      },
    ])
  })

  afterEach(() => {
    delete process.env.GEOCODING_SERVICE_URL
  })

  it("returns coordinates for a valid track name", async () => {
    const result = await geocodeTrack("Canberra")

    expect(result).toEqual({
      latitude: -35.2809,
      longitude: 149.13,
      displayName: "Canberra, Australian Capital Territory, Australia",
    })
  })

  it("calls Nominatim with query parameters", async () => {
    await geocodeTrack("New York")

    expect(mockHttpsRequest).toHaveBeenCalled()
    const opts = mockHttpsRequest.mock.calls[0][0] as {
      hostname: string
      path: string
      method: string
    }
    expect(opts.method).toBe("GET")
    expect(opts.hostname).toContain("openstreetmap.org")
    expect(opts.path).toContain("q=New+York")
    expect(opts.path).toContain("format=json")
    expect(opts.path).toContain("limit=1")
  })

  it("includes User-Agent header", async () => {
    await geocodeTrack("London")

    const opts = mockHttpsRequest.mock.calls[0][0] as { headers: Record<string, string> }
    expect(opts.headers["User-Agent"]).toContain("My Race Engineer")
  })

  it("caches geocoding results", async () => {
    await geocodeTrack("Berlin-cache")
    await geocodeTrack("Berlin-cache")

    expect(mockHttpsRequest).toHaveBeenCalledTimes(1)
  })

  it("waits between distinct track requests (rate limit)", async () => {
    vi.useFakeTimers()
    __resetGeocodeTestState()
    successJson([{ lat: "48.8566", lon: "2.3522", display_name: "Paris" }])

    const p1 = geocodeTrack("Paris-rate-a")
    await p1

    const p2 = geocodeTrack("Paris-rate-b")
    await vi.advanceTimersByTimeAsync(1000)
    await p2

    expect(mockHttpsRequest).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("throws when API returns non-200", async () => {
    __resetGeocodeTestState()
    successJson([], 500)

    await expect(geocodeTrack("Bad")).rejects.toThrow("Geocoding API returned status 500")
  })

  it("throws when no results", async () => {
    __resetGeocodeTestState()
    successJson([])

    await expect(geocodeTrack("NonexistentTrack12345")).rejects.toThrow(
      "No geocoding results found"
    )
  })

  it("wraps request errors", async () => {
    __resetGeocodeTestState()
    mockHttpsRequest.mockImplementation(() => {
      const req = new EventEmitter()
      return Object.assign(req, {
        end: vi.fn(() => {
          queueMicrotask(() => req.emit("error", new Error("network down")))
        }),
        setTimeout: vi.fn(),
        destroy: vi.fn(),
      })
    })

    await expect(geocodeTrack("Test")).rejects.toThrow("network down")
  })

  it("uses GEOCODING_SERVICE_URL host when set", async () => {
    __resetGeocodeTestState()
    process.env.GEOCODING_SERVICE_URL = "https://custom-geocoding.example.com/search"
    successJson([{ lat: "0", lon: "0", display_name: "Test" }])

    await geocodeTrack("Test")

    const opts = mockHttpsRequest.mock.calls[0][0] as { hostname: string }
    expect(opts.hostname).toBe("custom-geocoding.example.com")
  })
})
