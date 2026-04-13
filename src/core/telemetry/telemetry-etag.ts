import "server-only"

import { createHash } from "crypto"

/**
 * Weak ETag from stable parts (e.g. session id, updatedAt, query keys).
 */
export function weakEtagFromParts(parts: (string | number | null | undefined)[]): string {
  const s = parts.filter((p) => p !== undefined && p !== null && p !== "").join("|")
  return `W/"${createHash("sha256").update(s).digest("hex").slice(0, 32)}"`
}
