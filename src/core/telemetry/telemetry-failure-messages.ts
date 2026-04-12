/**
 * User-facing messages for telemetry processing failure codes (worker / parser).
 * @see docs/telemetry/Design/Telemetry_Import_UX_Design.md §6.4
 */

const TELEMETRY_FAILURE_MESSAGES: Record<string, string> = {
  FORMAT_NOT_RECOGNISED: "We couldn't recognise this file format. Try exporting as CSV or GPX.",
  CSV_NO_TIME_COLUMN: "This file doesn't have a time column. Export with timestamps enabled.",
  CSV_NO_POSITION_COLUMNS: "This file doesn't have position data (latitude and longitude).",
  CSV_AMBIGUOUS_TIME_FORMAT:
    "We couldn't interpret the time column. Use ISO timestamps or a single unambiguous format.",
  CSV_EMPTY: "This CSV file is empty.",
  CSV_NO_HEADER: "This CSV doesn't have a header row we can read.",
  CSV_NO_DATA: "This CSV has no usable data rows.",
  CSV_UNSUPPORTED_ENCODING: "We couldn't read this file as UTF-8. Save it as UTF-8 and try again.",
  INTEGRITY_HASH_MISMATCH: "File was corrupted during upload. Please re-upload.",
  PARSE_ERROR: "We couldn't process this file. Check the format and try again.",
  PARSE_RAW_FAILED: "We couldn't process this file. Check the format and try again.",
  ARTIFACT_VALIDATE_FAILED: "We couldn't validate the uploaded file. Try uploading again.",
  FILE_NOT_FOUND: "The uploaded file was missing on the server. Try uploading again.",
  SIZE_MISMATCH: "The file size didn't match what was uploaded. Please re-upload.",
  GPX_PARSE_ERROR: "This GPX file isn't valid XML. Export again from your device.",
  GPX_NOT_GPX: "This file isn't a GPX document. Try exporting as GPX.",
  GPX_NO_TRACKPOINTS: "This GPX has no track points. Export a route with track data.",
  GPX_MISSING_TIME: "This GPX is missing time on track points. Export with timestamps.",
  GPX_NO_VALID_POINTS: "No track points had both position and time.",
}

export function telemetryFailureUserMessage(
  code: string | null | undefined,
  detail?: string | null
): string {
  if (!code) {
    return detail?.trim() || "Processing failed. Try again or use a different export."
  }
  const mapped = TELEMETRY_FAILURE_MESSAGES[code]
  if (mapped) return mapped
  if (detail?.trim()) return detail.trim()
  return "We couldn't process this file. Check the format and try again."
}
