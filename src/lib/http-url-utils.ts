/** Build an absolute URL string for anchors; accepts values with or without scheme. */
export function toAbsoluteHttpHref(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  try {
    return t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`
  } catch {
    return null
  }
}

/** True when origins and pathnames match (trailing slashes ignored). */
export function httpUrlsComparableEqual(a: string, b: string): boolean {
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    const pathA = ua.pathname.replace(/\/+$/, "") || "/"
    const pathB = ub.pathname.replace(/\/+$/, "") || "/"
    return ua.origin.toLowerCase() === ub.origin.toLowerCase() && pathA === pathB
  } catch {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
  }
}
