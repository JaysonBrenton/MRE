#!/usr/bin/env node
/**
 * Build docs/frontend/component-catalog.md from component-files.manifest.json.
 * Purpose text is derived from the filename (humanized); refine in Git when needed.
 *
 * Run: node scripts/generate-component-catalog-markdown.mjs
 * Docker: docker exec -it mre-app node scripts/generate-component-catalog-markdown.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, "..")
const MANIFEST = path.join(
  REPO_ROOT,
  "docs",
  "reference",
  "generated",
  "component-files.manifest.json"
)
const OUT = path.join(REPO_ROOT, "docs", "frontend", "component-catalog.md")

function humanizeFilename(file) {
  const base = path.basename(file).replace(/\.(tsx|ts)$/, "")
  return base
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/_/g, " ")
}

function tierLabel(tier) {
  if (tier.startsWith("organism:")) return `organism (${tier.slice("organism:".length)})`
  return tier
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error("Run scripts/generate-documentation-inventory.mjs first.")
    process.exit(1)
  }
  const { generatedAt, count, exclusions, components } = JSON.parse(
    fs.readFileSync(MANIFEST, "utf8")
  )

  const byArea = new Map()
  for (const c of components) {
    const area = c.featureArea
    if (!byArea.has(area)) byArea.set(area, [])
    byArea.get(area).push(c)
  }
  const areas = [...byArea.keys()].sort()

  let md = `---
created: 2026-03-22
description: UI component inventory aligned with src/components
purpose:
  One row per component module (build-first). Regenerate with
  scripts/generate-component-catalog-markdown.mjs after adding/removing files.
relatedFiles:
  - docs/architecture/atomic-design-system.md
  - docs/reference/generated/component-files.manifest.json
---

# MRE component catalog

**Generated:** ${generatedAt}  
**Count:** ${count} files  
**Exclusions:** ${exclusions}

This catalog lists every production component file under [\`src/components/\`](../../src/components/).
Tier and feature area come from path conventions in
[\`docs/architecture/atomic-design-system.md\`](../architecture/atomic-design-system.md).
**Purpose** is a short human-readable label derived from the filename; read the
source file for behavior and props.

`

  for (const area of areas) {
    const rows = byArea.get(area).sort((a, b) => a.file.localeCompare(b.file))
    md += `## ${area}\n\n`
    md += "| File | Tier | Purpose |\n"
    md += "| --- | --- | --- |\n"
    for (const c of rows) {
      const purpose = humanizeFilename(c.file)
      md += `| \`${c.file}\` | ${tierLabel(c.tier)} | ${purpose} |\n`
    }
    md += "\n"
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, md, "utf8")
  console.log(`Wrote ${OUT}`)
}

main()
