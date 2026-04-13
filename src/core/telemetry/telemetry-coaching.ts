import "server-only"

export type TelemetryCoachingPayload = {
  lapCount: number
  cornerSegmentCount: number
  straightSegmentCount: number
  tips: string[]
}

/**
 * Lightweight heuristic coaching copy from stored quality summary + lap count.
 */
export function buildTelemetryCoachingPayload(
  qualitySummary: unknown,
  lapCount: number
): TelemetryCoachingPayload {
  const q =
    qualitySummary && typeof qualitySummary === "object" && qualitySummary !== null
      ? (qualitySummary as Record<string, unknown>)
      : null
  const segs = q?.segments
  const segList = Array.isArray(segs) ? segs : []
  let corners = 0
  let straights = 0
  for (const s of segList) {
    if (s && typeof s === "object" && s !== null) {
      const t = (s as { type?: string }).type
      if (t === "corner") corners += 1
      if (t === "straight") straights += 1
    }
  }

  const qual = q?.quality
  const qObj =
    qual && typeof qual === "object" && qual !== null ? (qual as Record<string, unknown>) : null
  const reasonCodes = qObj?.reason_codes
  const codes = Array.isArray(reasonCodes) ? reasonCodes.map(String) : []

  const tips: string[] = []
  if (lapCount === 0) {
    tips.push(
      "No complete laps were detected. Set a start/finish line on the map or link a catalogue track that has one, then reprocess."
    )
  } else if (lapCount > 0) {
    tips.push(
      `Detected ${lapCount} lap segment(s). Use Compare sessions (two or more IDs) to line up best laps side by side.`
    )
  }
  if (corners > 0) {
    tips.push(
      `Roughly ${corners} corner segment(s) and ${straights} straight segment(s) inferred from GNSS heading rate — useful for comparing line choice between laps.`
    )
  }
  if (codes.includes("GNSS_RATE_BELOW_5HZ")) {
    tips.push(
      "Sample rate is below 5 Hz — lap and corner analysis will be unreliable for most tracks."
    )
  }
  if (codes.includes("GNSS_RATE_BELOW_10HZ")) {
    tips.push(
      "Sample rate is below 10 Hz; lap splits and corner detection will be less precise. Prefer 10 Hz+ logging when possible."
    )
  }
  if (codes.includes("GNSS_LARGE_TIME_GAP")) {
    tips.push("Large time gaps in GNSS — check logger continuity, tunneling, or device sleep.")
  }
  if (codes.includes("GNSS_SHORT_SESSION")) {
    tips.push("Very few GNSS samples — confirm the full session was exported.")
  }
  const fusion = q?.fusion
  const fObj =
    fusion && typeof fusion === "object" && fusion !== null
      ? (fusion as Record<string, unknown>)
      : null
  if (fObj?.poseSource === "ekf_gnss_imu") {
    tips.push(
      "Pose used GNSS + IMU fusion (EKF). Check fusion metadata for magnetometer gating when 9-axis data is present."
    )
  }

  return {
    lapCount,
    cornerSegmentCount: corners,
    straightSegmentCount: straights,
    tips: tips.slice(0, 12),
  }
}
