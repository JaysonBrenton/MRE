import { prisma } from "@/lib/prisma"
import { assertCarTaxonomyPrismaReady } from "@/core/car-taxonomy/prisma-delegates"

export async function getAllCarTaxonomyNodes() {
  assertCarTaxonomyPrismaReady()
  return prisma.carTaxonomyNode.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  })
}

export async function getCarTaxonomyNodeById(id: string) {
  assertCarTaxonomyPrismaReady()
  return prisma.carTaxonomyNode.findUnique({ where: { id } })
}

export async function getUserCarTaxonomyRules(userId: string) {
  assertCarTaxonomyPrismaReady()
  return prisma.userCarTaxonomyRule.findMany({
    where: { userId },
    include: { taxonomyNode: true },
    orderBy: [{ matchType: "asc" }, { patternNormalized: "asc" }],
  })
}

export async function createUserCarTaxonomyRule(params: {
  userId: string
  matchType: import("@prisma/client").CarTaxonomyMatchType
  patternNormalized: string
  taxonomyNodeId: string
}) {
  assertCarTaxonomyPrismaReady()
  return prisma.userCarTaxonomyRule.create({
    data: {
      userId: params.userId,
      matchType: params.matchType,
      patternNormalized: params.patternNormalized,
      taxonomyNodeId: params.taxonomyNodeId,
    },
    include: { taxonomyNode: true },
  })
}

export async function updateUserCarTaxonomyRule(params: {
  userId: string
  ruleId: string
  taxonomyNodeId: string
}) {
  assertCarTaxonomyPrismaReady()
  const existing = await prisma.userCarTaxonomyRule.findFirst({
    where: { id: params.ruleId, userId: params.userId },
  })
  if (!existing) {
    throw new Error("CAR_TAXONOMY_RULE_NOT_FOUND")
  }
  return prisma.userCarTaxonomyRule.update({
    where: { id: params.ruleId },
    data: { taxonomyNodeId: params.taxonomyNodeId },
    include: { taxonomyNode: true },
  })
}

export async function deleteUserCarTaxonomyRule(userId: string, ruleId: string) {
  assertCarTaxonomyPrismaReady()
  const existing = await prisma.userCarTaxonomyRule.findFirst({
    where: { id: ruleId, userId },
  })
  if (!existing) {
    throw new Error("CAR_TAXONOMY_RULE_NOT_FOUND")
  }
  await prisma.userCarTaxonomyRule.delete({
    where: { id: ruleId },
  })
}
