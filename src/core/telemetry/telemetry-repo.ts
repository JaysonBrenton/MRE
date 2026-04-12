/**
 * Telemetry upload + finalise orchestration (Postgres metadata + local bytes).
 */

import { createHash, randomUUID } from "crypto"
import {
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

export const TELEMETRY_PIPELINE_VERSION = "telemetry-infra-0.1.0"
export const TELEMETRY_CANONICALISER_VERSION = "stub-0.1.0"

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

export async function getTelemetrySessionForUser(sessionId: string, ownerUserId: string) {
  const session = await prisma.telemetrySession.findFirst({
    where: { id: sessionId, ownerUserId, deletedAt: null },
    include: {
      currentRun: true,
    },
  })
  return session
}
