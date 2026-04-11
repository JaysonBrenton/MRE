/**
 * GET /api/v1/car-taxonomy — hierarchical car taxonomy nodes (reference data for mapping UI).
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAllCarTaxonomyNodes } from "@/core/car-taxonomy/repo"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const nodes = await getAllCarTaxonomyNodes()
    return successResponse({ nodes }, 200, undefined, CACHE_CONTROL.STATIC) as NextResponse
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
