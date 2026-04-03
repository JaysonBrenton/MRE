#!/usr/bin/env node
/**
 * Build-first documentation inventory for MRE.
 * Emits machine-readable manifests under docs/reference/generated/ for API routes
 * and UI component files. Regenerate after adding routes or components.
 *
 * Run (Docker): docker exec -it mre-app node scripts/generate-documentation-inventory.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, "..")
const OUT_DIR = path.join(REPO_ROOT, "docs", "reference", "generated")

/** Folders under src/components/ documented separately (visual test harness, not production UI). */
const COMPONENT_EXCLUDE_DIRS = new Set(["overview-testing"])

function walkFiles(dir, acc, filterFn) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (COMPONENT_EXCLUDE_DIRS.has(e.name)) continue
      walkFiles(full, acc, filterFn)
    } else if (e.isFile() && filterFn(full)) {
      acc.push(full)
    }
  }
}

function relativePosix(fromRoot) {
  return path.relative(REPO_ROOT, fromRoot).split(path.sep).join("/")
}

function extractHttpMethods(routeFileContent) {
  const methods = new Set()
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g
  let m
  while ((m = re.exec(routeFileContent)) !== null) {
    methods.add(m[1])
  }
  return [...methods].sort()
}

function buildApiInventory() {
  const apiRoot = path.join(REPO_ROOT, "src", "app", "api")
  const routes = []
  walkFiles(apiRoot, routes, (f) => f.endsWith("route.ts") || f.endsWith("route.js"))
  routes.sort()

  const items = routes.map((abs) => {
    const rel = relativePosix(abs)
    const relDir = relativePosix(path.dirname(abs))
    // e.g. src/app/api/v1/health -> /api/v1/health
    const urlPath = "/" + relDir.replace(/^src\/app\//, "")
    const content = fs.readFileSync(abs, "utf8")
    const methods = extractHttpMethods(content)
    return {
      file: rel,
      urlPath: urlPath.replace(/\/$/, "") || "/",
      methods,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    source: "src/app/api",
    count: items.length,
    routes: items,
  }
}

function tierForComponent(relPath) {
  const p = relPath.replace(/^src\/components\//, "")
  if (p.startsWith("atoms/")) return "atom"
  if (p.startsWith("molecules/")) return "molecule"
  if (p.startsWith("organisms/")) {
    const rest = p.slice("organisms/".length)
    const area = rest.split("/")[0] || "organisms"
    return `organism:${area}`
  }
  if (p.startsWith("templates/")) return "template"
  if (p.startsWith("store/")) return "store"
  return "root"
}

function featureAreaForComponent(relPath) {
  const p = relPath.replace(/^src\/components\//, "")
  if (p.startsWith("organisms/")) {
    const parts = p.split("/")
    return parts[1] || "organisms"
  }
  if (p.startsWith("atoms/")) return "atoms"
  if (p.startsWith("molecules/")) return "molecules"
  if (p.startsWith("templates/")) return "templates"
  if (p.startsWith("store/")) return "store"
  return "root"
}

function buildComponentInventory() {
  const compRoot = path.join(REPO_ROOT, "src", "components")
  const files = []
  walkFiles(compRoot, files, (f) => {
    if (!/\.(tsx|ts)$/.test(f)) return false
    if (f.includes(".test.")) return false
    if (f.includes(`${path.sep}__tests__${path.sep}`)) return false
    return true
  })
  files.sort()

  const items = files.map((abs) => {
    const rel = relativePosix(abs)
    return {
      file: rel,
      tier: tierForComponent(rel),
      featureArea: featureAreaForComponent(rel),
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    source: "src/components",
    exclusions: "Excludes: *.test.ts, *.test.tsx, __tests__/**, organisms/**/overview-testing/**",
    count: items.length,
    components: items,
  }
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const api = buildApiInventory()
  const components = buildComponentInventory()

  fs.writeFileSync(
    path.join(OUT_DIR, "api-routes.manifest.json"),
    JSON.stringify(api, null, 2) + "\n",
    "utf8"
  )
  fs.writeFileSync(
    path.join(OUT_DIR, "component-files.manifest.json"),
    JSON.stringify(components, null, 2) + "\n",
    "utf8"
  )

  console.log(
    `Wrote ${api.count} API route files and ${components.count} component files to ${relativePosix(OUT_DIR)}/`
  )
}

main()
