/**
 * @fileoverview Admin ingestion control operations
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Functions for controlling LiveRC ingestion from admin console
 * 
 * @purpose Provides ingestion control functionality for administrators,
 *          including triggering ingestion jobs and viewing ingestion status.
 * 
 * @relatedFiles
 * - src/core/admin/audit.ts (audit logging)
 * - ingestion/ (Python ingestion service)
 */

import { env } from "@/lib/env"
import { createAuditLog } from "./audit"

/**
 * Trigger track sync ingestion
 * 
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 * @returns Ingestion job status
 */
export async function triggerTrackSync(
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; message: string }> {
  const ingestionServiceUrl = env.INGESTION_SERVICE_URL || "http://localhost:8000"
  
  try {
    const response = await fetch(`${ingestionServiceUrl}/api/v1/tracks/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Ingestion service returned ${response.status}`)
    }

    await createAuditLog({
      userId: adminUserId,
      action: "ingestion.trigger_track_sync",
      resourceType: "ingestion",
      resourceId: null,
      details: {
        serviceUrl: ingestionServiceUrl,
      },
      ipAddress,
      userAgent,
    })

    return {
      success: true,
      message: "Track sync triggered successfully",
    }
  } catch (error) {
    await createAuditLog({
      userId: adminUserId,
      action: "ingestion.trigger_track_sync.failed",
      resourceType: "ingestion",
      resourceId: null,
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      ipAddress,
      userAgent,
    })

    throw new Error(
      error instanceof Error
        ? `Failed to trigger track sync: ${error.message}`
        : "Failed to trigger track sync"
    )
  }
}

/**
 * Trigger event ingestion for a specific event
 * 
 * @param eventId - Event ID to ingest
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 * @returns Ingestion job status
 */
export async function triggerEventIngestion(
  eventId: string,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; message: string }> {
  const ingestionServiceUrl = env.INGESTION_SERVICE_URL || "http://localhost:8000"
  
  try {
    const response = await fetch(`${ingestionServiceUrl}/api/v1/events/${eventId}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Ingestion service returned ${response.status}`)
    }

    await createAuditLog({
      userId: adminUserId,
      action: "ingestion.trigger_event_ingestion",
      resourceType: "event",
      resourceId: eventId,
      details: {
        serviceUrl: ingestionServiceUrl,
      },
      ipAddress,
      userAgent,
    })

    return {
      success: true,
      message: "Event ingestion triggered successfully",
    }
  } catch (error) {
    await createAuditLog({
      userId: adminUserId,
      action: "ingestion.trigger_event_ingestion.failed",
      resourceType: "event",
      resourceId: eventId,
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      ipAddress,
      userAgent,
    })

    throw new Error(
      error instanceof Error
        ? `Failed to trigger event ingestion: ${error.message}`
        : "Failed to trigger event ingestion"
    )
  }
}

/**
 * Get ingestion service health status
 * 
 * @returns Health status
 */
export async function getIngestionServiceHealth(): Promise<{
  healthy: boolean
  message: string
  responseTime?: number
}> {
  const ingestionServiceUrl = env.INGESTION_SERVICE_URL || "http://localhost:8000"
  
  try {
    const startTime = Date.now()
    const response = await fetch(`${ingestionServiceUrl}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
    const responseTime = Date.now() - startTime

    if (!response.ok) {
      return {
        healthy: false,
        message: `Ingestion service returned ${response.status}`,
        responseTime,
      }
    }

    return {
      healthy: true,
      message: "Ingestion service is healthy",
      responseTime,
    }
  } catch (error) {
    return {
      healthy: false,
      message:
        error instanceof Error
          ? `Failed to connect: ${error.message}`
          : "Failed to connect to ingestion service",
    }
  }
}

