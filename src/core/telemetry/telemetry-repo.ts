/**
 * Telemetry upload + finalise orchestration (Postgres metadata + local bytes).
 */

import { createHash, randomBytes, randomUUID } from "crypto"
import { rm } from "fs/promises"
import path from "path"
import {
  Prisma,
  TelemetryArtifactStatus,
  TelemetryDatasetType,
  TelemetryJobStatus,
  TelemetryProcessingRunStatus,
  TelemetrySessionPrivacy,
  TelemetrySessionStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  absolutePathFromStoragePath,
  buildTelemetryStorageRelativePath,
  getTelemetryUploadRoot,
  writeTelemetryBytesToDisk,
} from "./telemetry-upload-storage"
import { deleteTelemetrySessionClickhouseRows } from "./telemetry-clickhouse"
import {
  encodeTelemetryListCursor,
  resolveDatasetParquetRelativePath,
} from "./telemetry-session-list"
import type { TelemetrySessionListCursor } from "./telemetry-session-list"

export type { TelemetrySessionListCursor } from "./telemetry-session-list"
export {
  decodeTelemetryListCursor,
  resolveDatasetParquetRelativePath,
} from "./telemetry-session-list"

export const TELEMETRY_PIPELINE_VERSION = "telemetry-v1-0.9.0"
export const TELEMETRY_CANONICALISER_VERSION = "csv-gpx-nmea-json-ubx-parquet-v1-0.9.0"

export type CreateUploadIntentInput = {
  originalFileName: string
  contentType: string
}

export async function createTelemetryUploadIntent(
  ownerUserId: string,
  input: CreateUploadIntentInput
) {
  const id = randomUUID()
  const storagePath = buildTelemetryStorageRelativePath(ownerUserId, id)

  const artifact = await prisma.telemetryArtifact.create({
    data: {
      id,
      ownerUserId,
      sessionId: null,
      originalFileName: input.originalFileName.trim() || "upload.bin",
      contentType: input.contentType.trim() || "application/octet-stream",
      byteSize: BigInt(0),
      sha256: "",
      storagePath,
      status: TelemetryArtifactStatus.UPLOADED,
    },
  })

  return artifact
}

export async function writeTelemetryArtifactBytes(params: {
  ownerUserId: string
  artifactId: string
  bytes: Buffer
}) {
  const { ownerUserId, artifactId, bytes } = params

  const artifact = await prisma.telemetryArtifact.findFirst({
    where: { id: artifactId, ownerUserId },
  })
  if (!artifact) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }
  if (artifact.sessionId) {
    return { ok: false as const, code: "ALREADY_FINALISED" as const }
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex")

  await writeTelemetryBytesToDisk(artifact.storagePath, bytes)

  const updated = await prisma.telemetryArtifact.update({
    where: { id: artifactId },
    data: {
      byteSize: BigInt(bytes.length),
      sha256,
      uploadedAt: new Date(),
    },
  })

  return { ok: true as const, artifact: updated }
}

export type FinaliseUploadInput = {
  name?: string
  /** Optional link to `events.id` (imported LiveRC event). */
  livercEventId?: string | null
  /** Optional link to `races.id` (practice / race session row). */
  livercRaceId?: string | null
}

export function buildSessionEtag(updatedAt: Date, sessionId: string): string {
  return `W/"${updatedAt.getTime()}-${sessionId}"`
}

/**
 * Creates session, processing run, initial pipeline job, and links the artifact.
 */
export async function finaliseTelemetryUpload(
  ownerUserId: string,
  artifactId: string,
  input: FinaliseUploadInput
) {
  const artifact = await prisma.telemetryArtifact.findFirst({
    where: { id: artifactId, ownerUserId },
  })
  if (!artifact) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }
  if (artifact.sessionId) {
    return {
      ok: true as const,
      idempotent: true as const,
      sessionId: artifact.sessionId,
    }
  }
  if (artifact.byteSize <= BigInt(0) || !artifact.sha256) {
    return { ok: false as const, code: "BYTES_REQUIRED" as const }
  }

  const now = new Date()

  if (input.livercEventId) {
    const ev = await prisma.event.findUnique({ where: { id: input.livercEventId } })
    if (!ev) {
      return { ok: false as const, code: "BAD_LIVERC_EVENT" as const }
    }
  }
  if (input.livercRaceId) {
    const r = await prisma.race.findUnique({ where: { id: input.livercRaceId } })
    if (!r) {
      return { ok: false as const, code: "BAD_LIVERC_RACE" as const }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.telemetrySession.create({
      data: {
        ownerUserId,
        name: input.name?.trim() || artifact.originalFileName,
        privacy: TelemetrySessionPrivacy.PRIVATE,
        startTimeUtc: now,
        endTimeUtc: now,
        status: TelemetrySessionStatus.PROCESSING,
        livercEventId: input.livercEventId ?? undefined,
        livercRaceId: input.livercRaceId ?? undefined,
      },
    })

    await tx.telemetryArtifact.update({
      where: { id: artifactId },
      data: { sessionId: session.id },
    })

    const run = await tx.telemetryProcessingRun.create({
      data: {
        sessionId: session.id,
        status: TelemetryProcessingRunStatus.QUEUED,
        requestedByUserId: ownerUserId,
        pipelineVersion: TELEMETRY_PIPELINE_VERSION,
        canonicaliserVersion: TELEMETRY_CANONICALISER_VERSION,
        inputArtifactIds: [artifactId],
      },
    })

    await tx.telemetrySession.update({
      where: { id: session.id },
      data: { currentRunId: run.id },
    })

    await tx.telemetryJob.create({
      data: {
        runId: run.id,
        jobType: "artifact_validate",
        status: TelemetryJobStatus.QUEUED,
        payload: { artifactId },
      },
    })

    return { sessionId: session.id, runId: run.id }
  })

  return { ok: true as const, idempotent: false as const, ...result }
}

/**
 * Re-queue pipeline for a failed session (same upload artifact). Used after infra/parser fixes.
 */
export async function retryTelemetryProcessing(
  ownerUserId: string,
  sessionId: string
): Promise<
  { ok: true; runId: string } | { ok: false; code: "NOT_FOUND" | "NOT_FAILED" | "NO_ARTIFACT" }
> {
  const session = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
  })
  if (!session) {
    return { ok: false, code: "NOT_FOUND" }
  }
  if (session.status !== TelemetrySessionStatus.FAILED) {
    return { ok: false, code: "NOT_FAILED" }
  }

  const artifact = await prisma.telemetryArtifact.findFirst({
    where: { sessionId: session.id },
    orderBy: { uploadedAt: "asc" },
  })
  if (!artifact) {
    return { ok: false, code: "NO_ARTIFACT" }
  }

  const runId = await prisma.$transaction(async (tx) => {
    const run = await tx.telemetryProcessingRun.create({
      data: {
        sessionId: session.id,
        status: TelemetryProcessingRunStatus.QUEUED,
        requestedByUserId: ownerUserId,
        pipelineVersion: TELEMETRY_PIPELINE_VERSION,
        canonicaliserVersion: TELEMETRY_CANONICALISER_VERSION,
        inputArtifactIds: [artifact.id],
      },
    })
    await tx.telemetrySession.update({
      where: { id: session.id },
      data: {
        status: TelemetrySessionStatus.PROCESSING,
        currentRunId: run.id,
      },
    })
    await tx.telemetryJob.create({
      data: {
        runId: run.id,
        jobType: "artifact_validate",
        status: TelemetryJobStatus.QUEUED,
        payload: { artifactId: artifact.id },
      },
    })
    return run.id
  })

  return { ok: true, runId }
}

export async function getTelemetrySessionsForCompare(ownerUserId: string, ids: string[]) {
  if (ids.length < 2 || ids.length > 4) return []
  return prisma.telemetrySession.findMany({
    where: {
      id: { in: ids },
      ownerUserId,
      deletedAt: null,
      status: TelemetrySessionStatus.READY,
    },
    include: {
      track: { select: { trackName: true } },
      laps: { orderBy: { lapNumber: "asc" } },
    },
  })
}

export async function listTelemetrySessionsForUser(
  ownerUserId: string,
  opts: {
    limit: number
    cursor?: TelemetrySessionListCursor | null
    status?: TelemetrySessionStatus
  }
) {
  const take = Math.min(Math.max(opts.limit, 1), 200)

  const where: Prisma.TelemetrySessionWhereInput = {
    ownerUserId,
    deletedAt: null,
  }
  if (opts.status) {
    where.status = opts.status
  }
  if (opts.cursor) {
    const d = new Date(opts.cursor.createdAt)
    where.OR = [
      { createdAt: { lt: d } },
      { AND: [{ createdAt: d }, { id: { lt: opts.cursor.id } }] },
    ]
  }

  const rows = await prisma.telemetrySession.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: {
      _count: { select: { datasets: true } },
      currentRun: {
        select: {
          id: true,
          status: true,
          qualitySummary: true,
        },
      },
    },
  })

  const hasMore = rows.length > take
  const page = hasMore ? rows.slice(0, take) : rows
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeTelemetryListCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        })
      : null

  return { items: page, nextCursor }
}

/**
 * Canonical GNSS Parquet path for the primary CANON_GNSS dataset (session detail / export / timeseries).
 */
export function resolvePrimaryGnssParquetPath(session: {
  currentRun: { status: string; qualitySummary: unknown; outputDatasetIds: unknown } | null
  datasets: { id: string; datasetType: string }[]
}): string | null {
  const run = session.currentRun
  if (!run || run.status !== "SUCCEEDED") return null
  const gnss = session.datasets.find((d) => d.datasetType === TelemetryDatasetType.CANON_GNSS)
  if (!gnss) return null
  return resolveDatasetParquetRelativePath({
    datasetId: gnss.id,
    qualitySummary: run.qualitySummary,
    outputDatasetIds: run.outputDatasetIds,
  })
}

/** GNSS Parquet path for map preview (from last successful run quality summary). */
export function getGnssParquetRelativePathForMapPreview(session: {
  status: TelemetrySessionStatus
  currentRun: { qualitySummary: unknown } | null
}): string | null {
  if (session.status !== TelemetrySessionStatus.READY) return null
  const qs = session.currentRun?.qualitySummary
  if (!qs || typeof qs !== "object" || qs === null) return null
  const p = (qs as { parquetRelativePath?: unknown }).parquetRelativePath
  return typeof p === "string" && p.trim() ? p.trim() : null
}

export function resolvePrimaryGnssDatasetId(session: {
  currentRun: { status: string } | null
  datasets: { id: string; datasetType: string }[]
}): string | null {
  const run = session.currentRun
  if (!run || run.status !== "SUCCEEDED") return null
  const gnss = session.datasets.find((d) => d.datasetType === TelemetryDatasetType.CANON_GNSS)
  return gnss?.id ?? null
}

export async function getTelemetrySessionForUser(sessionId: string, ownerUserId: string) {
  const session = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
    include: {
      currentRun: true,
      track: {
        select: {
          id: true,
          trackName: true,
          startFinishLineGeoJson: true,
        },
      },
      datasets: {
        orderBy: { createdAt: "asc" },
      },
      laps: {
        orderBy: { lapNumber: "asc" },
      },
    },
  })
  return session
}

export async function getTelemetrySessionByShareToken(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) {
    return null
  }
  return prisma.telemetrySession.findFirst({
    where: { shareToken: token, deletedAt: null },
    include: {
      currentRun: true,
      track: {
        select: {
          id: true,
          trackName: true,
          startFinishLineGeoJson: true,
        },
      },
      datasets: {
        orderBy: { createdAt: "asc" },
      },
      laps: {
        orderBy: { lapNumber: "asc" },
      },
    },
  })
}

export async function mintTelemetryShareToken(
  ownerUserId: string,
  sessionId: string
): Promise<{ ok: true; token: string } | { ok: false; code: "NOT_FOUND" | "NOT_READY" }> {
  const row = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
  })
  if (!row) return { ok: false, code: "NOT_FOUND" }
  if (row.status !== TelemetrySessionStatus.READY) {
    return { ok: false, code: "NOT_READY" }
  }
  const token = randomBytes(24).toString("hex")
  await prisma.telemetrySession.update({
    where: { id: sessionId },
    data: {
      shareToken: token,
      shareTokenCreatedAt: new Date(),
    },
  })
  return { ok: true, token }
}

export async function revokeTelemetryShareToken(
  ownerUserId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" }> {
  const row = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
  })
  if (!row) return { ok: false, code: "NOT_FOUND" }
  await prisma.telemetrySession.update({
    where: { id: sessionId },
    data: {
      shareToken: null,
      shareTokenCreatedAt: null,
    },
  })
  return { ok: true }
}

export type UpdateTelemetrySessionPatchInput = {
  name?: string | null
  livercEventId?: string | null
  livercRaceId?: string | null
  /** Catalogue track (optional); used for track start/finish GeoJSON when present. */
  trackId?: string | null
  /** GeoJSON LineString (WGS84) for user-defined start/finish; re-process laps on next ingest if needed. */
  userSflLineGeoJson?: unknown | null
}

export async function updateTelemetrySessionForUser(
  ownerUserId: string,
  sessionId: string,
  input: UpdateTelemetrySessionPatchInput
): Promise<
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "BAD_LIVERC_EVENT" | "BAD_LIVERC_RACE" | "BAD_TRACK" }
> {
  const existing = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
  })
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" }
  }

  if (input.livercEventId) {
    const ev = await prisma.event.findUnique({ where: { id: input.livercEventId } })
    if (!ev) return { ok: false, code: "BAD_LIVERC_EVENT" }
  }
  if (input.livercRaceId) {
    const r = await prisma.race.findUnique({ where: { id: input.livercRaceId } })
    if (!r) return { ok: false, code: "BAD_LIVERC_RACE" }
  }
  if (input.trackId) {
    const tr = await prisma.track.findFirst({
      where: { id: input.trackId, isActive: true },
    })
    if (!tr) return { ok: false, code: "BAD_TRACK" }
  }

  await prisma.telemetrySession.update({
    where: { id: sessionId },
    data: {
      ...(input.name !== undefined && { name: input.name?.trim() || null }),
      ...(input.livercEventId !== undefined && { livercEventId: input.livercEventId }),
      ...(input.livercRaceId !== undefined && { livercRaceId: input.livercRaceId }),
      ...(input.trackId !== undefined && { trackId: input.trackId }),
      ...(input.userSflLineGeoJson !== undefined && {
        userSflLineGeoJson:
          input.userSflLineGeoJson === null
            ? Prisma.DbNull
            : (input.userSflLineGeoJson as Prisma.InputJsonValue),
      }),
    },
  })
  return { ok: true }
}

/**
 * Re-run full ingest for a READY session (e.g. after track or user SFL changed).
 * Removes prior run outputs (DB + canonical Parquet + ClickHouse cache) and enqueues a new job.
 */
export async function reprocessTelemetrySession(
  ownerUserId: string,
  sessionId: string
): Promise<
  | { ok: true; runId: string }
  | { ok: false; code: "NOT_FOUND" | "NOT_READY" | "NO_ARTIFACT" | "REPROCESS_COOLDOWN" }
> {
  const session = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
    include: {
      artifacts: { orderBy: { uploadedAt: "asc" }, take: 1 },
    },
  })
  if (!session) {
    return { ok: false, code: "NOT_FOUND" }
  }
  if (session.status !== TelemetrySessionStatus.READY) {
    return { ok: false, code: "NOT_READY" }
  }
  const artifact = session.artifacts[0]
  if (!artifact) {
    return { ok: false, code: "NO_ARTIFACT" }
  }

  const rawCooldown = Number(process.env.TELEMETRY_REPROCESS_COOLDOWN_SEC ?? "90")
  const cooldownSec = Number.isFinite(rawCooldown) ? Math.min(3600, Math.max(10, rawCooldown)) : 90
  if (session.lastReprocessAt) {
    const elapsed = Date.now() - session.lastReprocessAt.getTime()
    if (elapsed < cooldownSec * 1000) {
      return { ok: false, code: "REPROCESS_COOLDOWN" }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.telemetrySession.update({
      where: { id: sessionId },
      data: { currentRunId: null },
    })
    await tx.telemetryProcessingRun.deleteMany({
      where: { sessionId },
    })
  })

  await deleteTelemetrySessionClickhouseRows(sessionId)

  const root = getTelemetryUploadRoot()
  const canonicalDir = path.join(root, "canonical", sessionId)
  try {
    await rm(canonicalDir, { recursive: true, force: true })
  } catch {
    // best-effort
  }

  const runId = await prisma.$transaction(async (tx) => {
    const run = await tx.telemetryProcessingRun.create({
      data: {
        sessionId,
        status: TelemetryProcessingRunStatus.QUEUED,
        requestedByUserId: ownerUserId,
        pipelineVersion: TELEMETRY_PIPELINE_VERSION,
        canonicaliserVersion: TELEMETRY_CANONICALISER_VERSION,
        inputArtifactIds: [artifact.id],
      },
    })
    await tx.telemetrySession.update({
      where: { id: sessionId },
      data: {
        status: TelemetrySessionStatus.PROCESSING,
        currentRunId: run.id,
        lastReprocessAt: new Date(),
      },
    })
    await tx.telemetryJob.create({
      data: {
        runId: run.id,
        jobType: "artifact_validate",
        status: TelemetryJobStatus.QUEUED,
        payload: { artifactId: artifact.id },
      },
    })
    return run.id
  })

  return { ok: true, runId }
}

/**
 * Removes a session (CASCADE in DB) and best-effort deletes canonical + upload files on disk.
 */
export async function deleteTelemetrySessionForUser(
  ownerUserId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" }> {
  const existing = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
    include: { artifacts: { select: { storagePath: true } } },
  })
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" }
  }

  const artifactPaths = [...new Set(existing.artifacts.map((a) => a.storagePath))]

  await deleteTelemetrySessionClickhouseRows(sessionId)

  await prisma.$transaction(async (tx) => {
    await tx.telemetrySession.updateMany({
      where: { id: sessionId, ownerUserId },
      data: { currentRunId: null },
    })
    await tx.telemetrySession.deleteMany({
      where: { id: sessionId, ownerUserId },
    })
  })

  const root = getTelemetryUploadRoot()
  const canonicalDir = path.join(root, "canonical", sessionId)
  try {
    await rm(canonicalDir, { recursive: true, force: true })
  } catch {
    // best-effort
  }
  for (const rel of artifactPaths) {
    try {
      await rm(absolutePathFromStoragePath(rel), { force: true })
    } catch {
      // best-effort
    }
  }

  return { ok: true }
}
