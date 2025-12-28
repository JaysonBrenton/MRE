/**
 * @fileoverview Admin users API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles GET requests for user management (admin only)
 * 
 * @purpose This API route provides admin access to user management operations.
 * 
 * @relatedFiles
 * - src/core/admin/users.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getUsers } from "@/core/admin/users"
import { successResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/admin/users
 * 
 * Get all users with pagination and filtering (admin only)
 * 
 * Query params:
 * - email (optional): Filter by email
 * - driverName (optional): Filter by driver name
 * - isAdmin (optional): Filter by admin status
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
    const email = searchParams.get("email") || undefined
    const driverName = searchParams.get("driverName") || undefined
    const isAdminParam = searchParams.get("isAdmin")
    const isAdmin = isAdminParam ? isAdminParam === "true" : undefined
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!) : 50

    const result = await getUsers({
      email,
      driverName,
      isAdmin,
      page,
      pageSize,
    })

    return successResponse(result, 200, "Users retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorInfo.response
  }
}
