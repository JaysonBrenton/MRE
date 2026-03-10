/**
 * @fileoverview Chart color utilities - resolve CSS variables to hex for color pickers
 *
 * @description Resolves CSS custom properties (e.g. var(--token-text-primary)) to hex
 * for use in color pickers and other contexts that require hex values.
 */

/**
 * Resolve a color (hex or CSS variable) to hex for display in color pickers.
 * Returns input if already hex. Resolves var() via getComputedStyle when in browser.
 */
export function resolveColorToHex(color: string, fallback = "#3a8eff"): string {
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) return color
  if (typeof window === "undefined" || !color.startsWith("var(")) return color
  const match = color.match(/var\(([^)]+)\)/)
  if (!match) return fallback
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1].trim())
    .trim()
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(resolved)) return resolved
  if (resolved.startsWith("rgb")) {
    const [r, g, b] = resolved.match(/\d+/g)?.map(Number) ?? []
    if (r != null && g != null && b != null) {
      return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`
    }
  }
  return fallback
}
