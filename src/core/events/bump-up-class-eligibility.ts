/**
 * @fileoverview Which race classes participate in bump-up inference (nitro-oriented).
 * Electric / EP (electric pro) classes are excluded — triple mains and LCQ ladders differ;
 * ingested grids rarely show cross-main driver continuity for EP classes.
 *
 * @see docs/plans/bump-ups-feature-spec.md
 */

/**
 * Returns true if this class should not appear in bump-up chips or inference.
 * Uses `className` and optional `EventRaceClass.vehicleType` when present.
 */
export function isClassExcludedFromBumpUps(
  className: string,
  vehicleType?: string | null
): boolean {
  const cn = className.trim()
  if (!cn) return true

  const cnL = cn.toLowerCase()
  const vtL = (vehicleType ?? "").trim().toLowerCase()

  // Nitro classes stay eligible (explicit in name or vehicle type)
  if (/\bnitro\b/i.test(cn)) return false
  if (vtL.includes("nitro")) return false

  // Electric in name or stored vehicle type
  if (/\belectric\b/i.test(cn)) return true
  if (vtL.includes("electric")) return true

  // LiveRC electric-pro prefix: "EP Buggy", "EP Truggy", …
  if (/^ep\s/i.test(cnL)) return true
  if (/\bep\s+(buggy|truggy|truck)\b/i.test(cnL)) return true

  return false
}
