/**
 * Telemetry upload + finalise orchestration (Postgres metadata + local bytes).
 */

import { createHash, randomUUID } from "crypto"
import {
  Prisma,
  TelemetryArtifactStatus,
  TelemetryJobStatus,
  TelemetryProcessingRunStatus,
  TelemetrySessionPrivacy,
  TelemetrySessionStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  buildTelemetryStorageRelativePath,
  writeTelemetryBytesToDisk,
} from "./telemetry-upload-storage"

export const TELEMETRY_PIPELINE_VERSION = "telemetry-mvp-0.2.0"
export const TELEMETRY_CANONICALISER_VERSION = "csv-gpx-parquet-0.2.0"

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

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.telemetrySession.create({
      data: {
        ownerUserId,
        name: input.name?.trim() || artifact.originalFileName,
        privacy: TelemetrySessionPrivacy.PRIVATE,
        startTimeUtc: now,
        endTimeUtc: now,
        status: TelemetrySessionStatus.PROCESSING,
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

export type TelemetrySessionListCursor = {
  createdAt: string
  id: string
}

function encodeTelemetryListCursor(c: TelemetrySessionListCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url")
}

export function decodeTelemetryListCursor(raw: string | null): TelemetrySessionListCursor | null {
  if (!raw?.trim()) return null
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8")
    const parsed = JSON.parse(json) as { createdAt?: unknown; id?: unknown }
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return { createdAt: parsed.createdAt, id: parsed.id }
    }
  } catch {
    return null
  }
  return null
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
 * Resolve parquet key from processing run quality summary for a dataset row.
 */
export function resolveDatasetParquetRelativePath(params: {
  datasetId: string
  qualitySummary: unknown
  outputDatasetIds: unknown
}): string | null {
  const { datasetId, qualitySummary, outputDatasetIds } = params
  if (!qualitySummary || typeof qualitySummary !== "object") return null
  const qs = qualitySummary as { parquetRelativePath?: unknown }
  const path = typeof qs.parquetRelativePath === "string" ? qs.parquetRelativePath.trim() : null
  if (!path) return null
  if (path.includes(datasetId)) return path.replace(/^[/\\]+/, "")

  let ids: string[] = []
  if (Array.isArray(outputDatasetIds)) {
    ids = outputDatasetIds.filter((x): x is string => typeof x === "string")
  }
  if (ids.length === 1 && ids[0] === datasetId) {
    return path.replace(/^[/\\]+/, "")
  }
  return null
}

export async function getTelemetrySessionForUser(sessionId: string, ownerUserId: string) {
  const session = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
    include: {
      currentRun: true,
      datasets: {
        orderBy: { createdAt: "asc" },
      },
    },
  })
  return session
}
