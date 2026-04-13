/**
 * @fileoverview Tests for fetchWeather — mocks Node `https` module (Open-Meteo via `https.request`).
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

import { fetchWeather } from "@/core/weather/fetch-weather"

function stubHttpsSuccess(body: unknown, statusCode = 200) {
  mockHttpsRequest.mockImplementation(
    (options: unknown, callback: (res: IncomingMessage) => void) => {
      const res = new EventEmitter() as IncomingMessage & { statusCode?: number }
      res.statusCode = statusCode
      callback!(res as IncomingMessage)
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

function openMeteoDayPayload(isoDay: string) {
  const n = 24
  const time: string[] = []
  const temperature_2m: number[] = []
  const relativehumidity_2m: number[] = []
  const windspeed_10m: number[] = []
  const winddirection_10m: (number | null)[] = []
  const weathercode: number[] = []
  const precipitation: (number | null)[] = []
  const precipitation_probability: (number | null)[] = []
  for (let h = 0; h < n; h++) {
    time.push(`${isoDay}T${String(h).padStart(2, "0")}:00`)
    temperature_2m.push(22.5)
    relativehumidity_2m.push(60)
    windspeed_10m.push(12)
    winddirection_10m.push(180)
    weathercode.push(1)
    precipitation.push(0)
    precipitation_probability.push(10)
  }
  return {
    hourly: {
      time,
      temperature_2m,
      relativehumidity_2m,
      windspeed_10m,
      winddirection_10m,
      weathercode,
      precipitation,
      precipitation_probability,
    },
  }
}

describe("fetchWeather", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubHttpsSuccess(openMeteoDayPayload("2030-06-15"))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("parses Open-Meteo hourly response into current, forecast, and daily summary", async () => {
    const result = await fetchWeather(-35.28, 149.13, new Date("2030-06-15T14:00:00.000Z"))

    expect(result.current.airTemperature).toBe(22.5)
    expect(result.current.humidity).toBe(60)
    expect(result.forecast).toHaveLength(3)
    expect(result.forecast[0].label).toBe("+15m")
    expect(result.forecast[1].label).toBe("+30m")
    expect(result.forecast[2].label).toBe("+45m")
    expect(result.dailyTemperatureSummary?.hourly.length).toBe(24)
  })

  it("throws when Open-Meteo returns non-200", async () => {
    stubHttpsSuccess({ hourly: {} }, 500)

    await expect(fetchWeather(0, 0, new Date("2030-06-15T12:00:00.000Z"))).rejects.toThrow(
      "Failed to fetch weather data: Open-Meteo API returned status 500"
    )
  })

  it("wraps request errors", async () => {
    mockHttpsRequest.mockImplementation(() => {
      const req = new EventEmitter()
      const r = Object.assign(req, {
        end: vi.fn(() => {
          queueMicrotask(() => req.emit("error", new Error("boom")))
        }),
        setTimeout: vi.fn(),
        destroy: vi.fn(),
      })
      return r
    })

    await expect(fetchWeather(0, 0, new Date("2030-06-15T12:00:00.000Z"))).rejects.toThrow(
      "Failed to fetch weather data: boom"
    )
  })

  it("issues GET to forecast API for future event dates", async () => {
    await fetchWeather(1, 2, new Date("2030-07-01T12:00:00.000Z"))

    expect(mockHttpsRequest).toHaveBeenCalled()
    const opts = mockHttpsRequest.mock.calls[0][0] as {
      hostname: string
      path: string
      method: string
    }
    expect(opts.method).toBe("GET")
    expect(opts.hostname).toBe("api.open-meteo.com")
    expect(opts.path).toContain("latitude=1")
    expect(opts.path).toContain("longitude=2")
  })
})
