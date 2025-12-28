/**
 * @fileoverview Admin logs API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles GET requests for log viewing (admin only)
 * 
 * @relatedFiles
 * - src/core/admin/logs.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getLogs } from "@/core/admin/logs"
import { successResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/admin/logs
 * 
 * Get logs with pagination and filtering (admin only)
 * 
 * Query params:
 * - source (optional): Filter by log source (nextjs, ingestion, database)
 * - level (optional): Filter by log level (debug, info, warn, error)
 * - startDate (optional): Filter by start date (ISO string)
 * - endDate (optional): Filter by end date (ISO string)
 * - search (optional): Search term
 * - page (optional): Page number (default: 1)
 * - pageSize (optional): Page size (default: 50)
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const searchParams = request.nextUrl.searchParams
    const source = searchParams.get("source") as "nextjs" | "ingestion" | "database" | null
    const level = searchParams.get("level") as "debug" | "info" | "warn" | "error" | null
    const startDateParam = searchParams.get("startDate")
    const startDate = startDateParam ? new Date(startDateParam) : undefined
    const endDateParam = searchParams.get("endDate")
    const endDate = endDateParam ? new Date(endDateParam) : undefined
    const search = searchParams.get("search") || undefined
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!) : 50

    const result = await getLogs({
      source: source || undefined,
      level: level || undefined,
      startDate,
      endDate,
      search,
      page,
      pageSize,
    })

    return successResponse(result, 200, "Logs retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorInfo.response
  }
}
