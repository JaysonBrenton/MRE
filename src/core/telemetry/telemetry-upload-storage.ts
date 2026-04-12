/**
 * Local filesystem layout for telemetry raw uploads (stage 1).
 * Object storage (S3-compatible) can be added later; paths stay relative to TELEMETRY_UPLOAD_ROOT.
 *
 * @see docs/telemetry/Design/Telemetry_MVP_Implementation_Decisions.md §3
 */

import { mkdir, writeFile, stat } from "fs/promises"
import path from "path"

export function getTelemetryUploadRoot(): string {
  return process.env.TELEMETRY_UPLOAD_ROOT?.trim() || "/data/telemetry"
}

/** Relative key stored on TelemetryArtifact.storagePath, e.g. uploads/{userId}/{artifactId} */
export function buildTelemetryStorageRelativePath(ownerUserId: string, artifactId: string): string {
  const safeOwner = path.basename(ownerUserId)
  const safeArtifact = path.basename(artifactId)
  return path.posix.join("uploads", safeOwner, safeArtifact)
}

export function absolutePathFromStoragePath(storagePath: string): string {
  const root = getTelemetryUploadRoot()
  const normalized = storagePath.replace(/^[/\\]+/, "")
  const parts = normalized.split("/").filter(Boolean)
  const joined = path.join(root, ...parts)
  const resolved = path.resolve(joined)
  const rootResolved = path.resolve(root)
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error("Invalid storage path: escapes upload root")
  }
  return resolved
}

export async function writeTelemetryBytesToDisk(
  storageRelativePath: string,
  bytes: Buffer
): Promise<void> {
  const abs = absolutePathFromStoragePath(storageRelativePath)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, bytes)
}

export async function telemetryFileExists(storageRelativePath: string): Promise<boolean> {
  try {
    await stat(absolutePathFromStoragePath(storageRelativePath))
    return true
  } catch {
    return false
  }
}

export async function readTelemetryFileSize(storageRelativePath: string): Promise<number> {
  const abs = absolutePathFromStoragePath(storageRelativePath)
  const s = await stat(abs)
  return s.size
}
