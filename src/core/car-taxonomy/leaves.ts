/**
 * Leaf nodes = taxonomy entries that have no children (selectable mapping targets).
 */
export function taxonomyLeafNodeIds(
  nodes: Array<{ id: string; parentId: string | null }>
): Set<string> {
  const idsWithChildren = new Set<string>()
  for (const n of nodes) {
    if (n.parentId) idsWithChildren.add(n.parentId)
  }
  return new Set(nodes.filter((n) => !idsWithChildren.has(n.id)).map((n) => n.id))
}

export function isTaxonomyLeafNode(
  nodeId: string,
  nodes: Array<{ id: string; parentId: string | null }>
): boolean {
  return taxonomyLeafNodeIds(nodes).has(nodeId)
}
