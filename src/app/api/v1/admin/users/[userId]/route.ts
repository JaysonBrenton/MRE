/**
 * @fileoverview Admin user management API endpoint (v1)
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Handles PATCH and DELETE requests for user management (admin only)
 *
 * @relatedFiles
 * - src/core/admin/users.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { updateUser, deleteUser, setAdminStatus } from "@/core/admin/users"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * PATCH /api/v1/admin/users/[userId]
 *
 * Update user details (admin only)
 *
 * Request body:
 * {
 *   driverName?: string
 *   teamName?: string | null
 *   email?: string
 *   isAdmin?: boolean
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId()

  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const { userId } = await params

    const bodyResult = await parseRequestBody<{
      driverName?: string
      teamName?: string | null
      email?: string
      isAdmin?: boolean
    }>(request)

    if (!bodyResult.success) {
      return bodyResult.response
    }

    const { isAdmin, ...updateData } = bodyResult.data

    // Handle admin status change separately
    if (isAdmin !== undefined) {
      const ipAddress =
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
      const userAgent = request.headers.get("user-agent") || undefined

      const updatedUser = await setAdminStatus(
        userId,
        isAdmin,
        authResult.userId,
        ipAddress,
        userAgent
      )
      return successResponse(updatedUser, 200, "User admin status updated successfully")
    }

    // Update other user fields
    if (Object.keys(updateData).length > 0) {
      const ipAddress =
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
      const userAgent = request.headers.get("user-agent") || undefined

      const updatedUser = await updateUser(
        userId,
        updateData,
        authResult.userId,
        ipAddress,
        userAgent
      )
      return successResponse(updatedUser, 200, "User updated successfully")
    }

    return successResponse({}, 200, "No changes to apply")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

/**
 * DELETE /api/v1/admin/users/[userId]
 *
 * Delete a user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId()

  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const { userId } = await params

    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    await deleteUser(userId, authResult.userId, ipAddress, userAgent)

    return successResponse({}, 200, "User deleted successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
