/**
 * @fileoverview Client-side weather for event analysis with session cache
 *
 * @description Fetches per-day weather for an event. Successful responses are cached
 *              by event id so switching tabs (which unmounts OverviewTab) does not
 *              refetch or flash loading state.
 */

"use client"

import { useEffect, useState } from "react"

import { clientLogger } from "@/lib/client-logger"
import type { EventWeatherData } from "@/types/weather"

export type WeatherDayRow = { date: string; weather: EventWeatherData }

const weatherByEventCache = new Map<string, WeatherDayRow[]>()

export function useEventWeather(eventId: string | undefined) {
  const [weatherByDay, setWeatherByDay] = useState<WeatherDayRow[] | null>(() =>
    eventId ? (weatherByEventCache.get(eventId) ?? null) : null
  )
  const [weatherLoading, setWeatherLoading] = useState(() => {
    if (!eventId) return false
    return !weatherByEventCache.has(eventId)
  })
  const [weatherError, setWeatherError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) {
      queueMicrotask(() => {
        setWeatherByDay(null)
        setWeatherError(null)
        setWeatherLoading(false)
      })
      return
    }
    const cached = weatherByEventCache.get(eventId)
    if (cached) {
      queueMicrotask(() => {
        setWeatherByDay(cached)
        setWeatherError(null)
        setWeatherLoading(false)
      })
      return
    }
    queueMicrotask(() => {
      setWeatherByDay(null)
      setWeatherLoading(true)
      setWeatherError(null)
    })

    let cancelled = false
    const url = `/api/v1/events/${eventId}/weather?perDay=true`
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 404) {
            setWeatherError("Event not found")
            return null
          }
          const errorData = await response.json().catch(() => ({}))
          setWeatherError(errorData.error?.message ?? "Failed to load weather data")
          return null
        }
        const result = await response.json()
        if (result.success && result.data?.days && Array.isArray(result.data.days)) {
          return result.data.days as WeatherDayRow[]
        }
        setWeatherError("Invalid response from server")
        return null
      })
      .then((days) => {
        if (cancelled) return
        if (days) {
          weatherByEventCache.set(eventId, days)
          setWeatherByDay(days)
          setWeatherError(null)
        }
      })
      .catch((error) => {
        if (cancelled) return
        clientLogger.error("Error fetching weather data", { error })
        setWeatherError("Failed to fetch weather data")
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  return { weatherByDay, weatherLoading, weatherError }
}
