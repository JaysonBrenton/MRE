/**
 * GET /api/v1/user/car-taxonomy-rules — list current user's global rules.
 * POST — create a rule.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserCarTaxonomyRules } from "@/core/car-taxonomy/repo"
import {
  createUserCarTaxonomyRuleForUser,
  type CreateUserCarTaxonomyRuleInput,
} from "@/core/car-taxonomy/user-rules-crud"
import { successResponse, errorResponse, parseRequestBody, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { Prisma } from "@prisma/client"
import type { CarTaxonomyMatchType } from "@prisma/client"

const MATCH_TYPES: CarTaxonomyMatchType[] = [
  "CLASS_AND_LABEL",
  "CLASS_NAME",
  "RACE_LABEL",
  "SECTION_HEADER",
  "SESSION_TYPE",
]

function isMatchType(s: string): s is CarTaxonomyMatchType {
  return MATCH_TYPES.includes(s as CarTaxonomyMatchType)
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const rules = await getUserCarTaxonomyRules(session.user.id)
    return successResponse({ rules }, 200, undefined, CACHE_CONTROL.NO_CACHE) as NextResponse
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const parsed = await parseRequestBody<Record<string, unknown>>(request)
    if (!parsed.success || !parsed.data) {
      return errorResponse("UNPROCESSABLE_ENTITY", "Invalid JSON body", undefined, 422)
    }

    const body = parsed.data
    const matchTypeRaw = body.matchType
    const taxonomyNodeId = typeof body.taxonomyNodeId === "string" ? body.taxonomyNodeId : ""

    if (!matchTypeRaw || typeof matchTypeRaw !== "string" || !isMatchType(matchTypeRaw)) {
      return errorResponse("VALIDATION_ERROR", "Invalid matchType", undefined, 400)
    }
    if (!taxonomyNodeId) {
      return errorResponse("VALIDATION_ERROR", "taxonomyNodeId is required", undefined, 400)
    }

    let input: CreateUserCarTaxonomyRuleInput
    if (matchTypeRaw === "CLASS_AND_LABEL") {
      const className = typeof body.className === "string" ? body.className : ""
      const raceLabel = typeof body.raceLabel === "string" ? body.raceLabel : ""
      if (!className.trim() || !raceLabel.trim()) {
        return errorResponse(
          "VALIDATION_ERROR",
          "className and raceLabel are required for CLASS_AND_LABEL",
          undefined,
          400
        )
      }
      input = { matchType: "CLASS_AND_LABEL", className, raceLabel, taxonomyNodeId }
    } else {
      const pattern = typeof body.pattern === "string" ? body.pattern : ""
      if (!pattern.trim()) {
        return errorResponse("VALIDATION_ERROR", "pattern is required", undefined, 400)
      }
      input = { matchType: matchTypeRaw, pattern, taxonomyNodeId }
    }

    try {
      const rule = await createUserCarTaxonomyRuleForUser(session.user.id, input)
      return successResponse({ rule }, 201, undefined, CACHE_CONTROL.NO_CACHE) as NextResponse
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return errorResponse(
          "CONFLICT",
          "A rule for this source and match type already exists",
          undefined,
          409
        )
      }
      if (e instanceof Error && e.message === "CAR_TAXONOMY_TARGET_NOT_LEAF") {
        return errorResponse(
          "VALIDATION_ERROR",
          "Select a specific vehicle class (leaf), not a category folder",
          undefined,
          400
        )
      }
      if (e instanceof Error && e.message === "CAR_TAXONOMY_PATTERN_INVALID") {
        return errorResponse("VALIDATION_ERROR", "Invalid pattern", undefined, 400)
      }
      throw e
    }
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
