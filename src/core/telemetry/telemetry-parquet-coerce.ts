/**
 * Parquet int64 often deserializes as JS bigint; float columns are numbers.
 * hyparquet may return either — strict `typeof === "number"` skips valid rows.
 */
export function coerceParquetNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "bigint") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}
