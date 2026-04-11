/**
 * PATCH / DELETE /api/v1/user/car-taxonomy-rules/:ruleId
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  removeUserCarTaxonomyRule,
  updateUserCarTaxonomyRuleTarget,
} from "@/core/car-taxonomy/user-rules-crud"
import { successResponse, errorResponse, parseRequestBody, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { ruleId } = await params
    const parsed = await parseRequestBody<{ taxonomyNodeId?: string }>(request)
    if (!parsed.success || !parsed.data) {
      return errorResponse("UNPROCESSABLE_ENTITY", "Invalid JSON body", undefined, 422)
    }

    const taxonomyNodeId = parsed.data.taxonomyNodeId
    if (!taxonomyNodeId || typeof taxonomyNodeId !== "string") {
      return errorResponse("VALIDATION_ERROR", "taxonomyNodeId is required", undefined, 400)
    }

    try {
      const rule = await updateUserCarTaxonomyRuleTarget(session.user.id, ruleId, taxonomyNodeId)
      return successResponse({ rule }, 200, undefined, CACHE_CONTROL.NO_CACHE) as NextResponse
    } catch (e) {
      if (e instanceof Error && e.message === "CAR_TAXONOMY_RULE_NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Rule not found", undefined, 404)
      }
      if (e instanceof Error && e.message === "CAR_TAXONOMY_TARGET_NOT_LEAF") {
        return errorResponse(
          "VALIDATION_ERROR",
          "Select a specific vehicle class (leaf), not a category folder",
          undefined,
          400
        )
      }
      throw e
    }
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { ruleId } = await params
    try {
      await removeUserCarTaxonomyRule(session.user.id, ruleId)
    } catch (e) {
      if (e instanceof Error && e.message === "CAR_TAXONOMY_RULE_NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Rule not found", undefined, 404)
      }
      throw e
    }
    return successResponse({ ok: true }, 200, undefined, CACHE_CONTROL.NO_CACHE) as NextResponse
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
