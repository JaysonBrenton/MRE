import type { CarTaxonomyMatchType } from "@prisma/client"
import {
  buildClassAndLabelPattern,
  normalizeCarTaxonomyPattern,
} from "@/core/car-taxonomy/normalize"
import { isTaxonomyLeafNode } from "@/core/car-taxonomy/leaves"
import {
  createUserCarTaxonomyRule,
  deleteUserCarTaxonomyRule,
  getAllCarTaxonomyNodes,
  updateUserCarTaxonomyRule,
} from "@/core/car-taxonomy/repo"

export type CreateUserCarTaxonomyRuleInput =
  | {
      matchType: "CLASS_AND_LABEL"
      className: string
      raceLabel: string
      taxonomyNodeId: string
    }
  | {
      matchType: Exclude<CarTaxonomyMatchType, "CLASS_AND_LABEL">
      pattern: string
      taxonomyNodeId: string
    }

function computePatternNormalized(input: CreateUserCarTaxonomyRuleInput): string {
  if (input.matchType === "CLASS_AND_LABEL") {
    return buildClassAndLabelPattern(input.className, input.raceLabel)
  }
  return normalizeCarTaxonomyPattern(input.pattern)
}

export async function assertTaxonomyLeafNode(taxonomyNodeId: string): Promise<void> {
  const nodes = await getAllCarTaxonomyNodes()
  if (!isTaxonomyLeafNode(taxonomyNodeId, nodes)) {
    throw new Error("CAR_TAXONOMY_TARGET_NOT_LEAF")
  }
}

export async function createUserCarTaxonomyRuleForUser(
  userId: string,
  input: CreateUserCarTaxonomyRuleInput
) {
  await assertTaxonomyLeafNode(input.taxonomyNodeId)
  const patternNormalized = computePatternNormalized(input)
  if (!patternNormalized || patternNormalized.length > 600) {
    throw new Error("CAR_TAXONOMY_PATTERN_INVALID")
  }
  return createUserCarTaxonomyRule({
    userId,
    matchType: input.matchType,
    patternNormalized,
    taxonomyNodeId: input.taxonomyNodeId,
  })
}

export async function updateUserCarTaxonomyRuleTarget(
  userId: string,
  ruleId: string,
  taxonomyNodeId: string
) {
  await assertTaxonomyLeafNode(taxonomyNodeId)
  return updateUserCarTaxonomyRule({ userId, ruleId, taxonomyNodeId })
}

export async function removeUserCarTaxonomyRule(userId: string, ruleId: string) {
  await deleteUserCarTaxonomyRule(userId, ruleId)
}
