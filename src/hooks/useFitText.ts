"use client"

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react"

export interface UseFitTextOptions {
  minPx: number
  maxPx: number
  /** When false, skips measurement (e.g. unmounted / empty content). */
  enabled?: boolean
  deps?: readonly unknown[]
}

/**
 * Scales an element's font size so its content fits within its container width on one line.
 * Observes container resize and re-fits when `deps` change (e.g. title text).
 */
export function useFitText(
  elementRef: RefObject<HTMLElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  { minPx, maxPx, enabled = true, deps = [] }: UseFitTextOptions
): void {
  const rafRef = useRef(0)
  const lastWidthRef = useRef(-1)
  const lastFontSizeRef = useRef<number | null>(null)
  const depsKey = JSON.stringify(deps)

  const measureAndFit = useCallback(
    (force = false) => {
      const el = elementRef.current
      const container = containerRef.current
      if (!el || !container) return

      const availableWidth = container.clientWidth
      if (availableWidth <= 0) return

      if (!force && lastWidthRef.current === availableWidth && lastFontSizeRef.current !== null) {
        return
      }

      let lo = minPx
      let hi = maxPx
      let best = minPx

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        el.style.fontSize = `${mid}px`
        if (el.scrollWidth <= el.clientWidth + 0.5) {
          best = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      lastWidthRef.current = availableWidth
      if (lastFontSizeRef.current !== best) {
        lastFontSizeRef.current = best
        el.style.fontSize = `${best}px`
      }
    },
    [containerRef, elementRef, maxPx, minPx]
  )

  const scheduleFit = useCallback(
    (force = false) => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        measureAndFit(force)
      })
    },
    [measureAndFit]
  )

  useLayoutEffect(() => {
    lastWidthRef.current = -1
    lastFontSizeRef.current = null
    if (!enabled) return
    measureAndFit(true)
  }, [enabled, measureAndFit, depsKey])

  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    let observedWidth = container.clientWidth

    const ro = new ResizeObserver((entries) => {
      const entry = entries.find((e) => e.target === container) ?? entries[0]
      if (!entry) return

      // Font-size fitting only affects width overflow; ignore height-only resize
      // notifications (line-height changes) to avoid ResizeObserver feedback loops.
      const nextWidth = entry.contentRect.width
      if (Math.abs(nextWidth - observedWidth) < 0.5) return
      observedWidth = nextWidth
      scheduleFit()
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [containerRef, enabled, scheduleFit])

  useEffect(() => {
    if (!enabled) return
    if (typeof document === "undefined" || !document.fonts?.ready) return

    void document.fonts.ready.then(() => {
      lastWidthRef.current = -1
      scheduleFit(true)
    })
  }, [enabled, scheduleFit, depsKey])
}
