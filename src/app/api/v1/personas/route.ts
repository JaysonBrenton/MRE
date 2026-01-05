/**
 * @fileoverview Personas API endpoint
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description API endpoint for listing all available personas
 *
 * @purpose This endpoint returns all available personas for the MRE application.
 *          Used by UI to display persona options and information.
 *
 * @relatedFiles
 * - src/core/personas/repo.ts (persona repository functions)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (API standards)
 */

import { getAllPersonas } from "@/core/personas/repo"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { logger } from "@/lib/logger"

/**
 * GET /api/v1/personas
 *
 * Returns list of all available personas
 */
export async function GET() {
  try {
    const personas = await getAllPersonas()

    // Static reference data - cache for 1 hour
    return successResponse(personas, 200, undefined, CACHE_CONTROL.STATIC)
  } catch (error) {
    logger.error("Error fetching personas", {
      error: error instanceof Error ? error.message : String(error),
    })

    return errorResponse("INTERNAL_ERROR", "Failed to fetch personas", undefined, 500)
  }
}
