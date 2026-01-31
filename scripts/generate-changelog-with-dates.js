#!/usr/bin/env node

/**
 * Custom changelog generator that includes dates and full commit messages
 * for each entry, maintaining Keep a Changelog format.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require("child_process")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path")

const CHANGELOG_FILE = path.join(__dirname, "..", "docs", "development", "CHANGELOG.md")
const PACKAGE_JSON = path.join(__dirname, "..", "package.json")

// Get current version from package.json
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"))
const currentVersion = packageJson.version

// Commit type mappings
const TYPE_MAPPINGS = {
  feat: "Added",
  add: "Added",
  create: "Added",
  new: "Added",
  fix: "Fixed",
  bug: "Fixed",
  bugfix: "Fixed",
  perf: "Changed",
  performance: "Changed",
  refactor: "Changed",
  update: "Changed",
  change: "Changed",
  improve: "Changed",
  optimize: "Changed",
  docs: "Documentation",
  doc: "Documentation",
  style: "Changed",
  format: "Changed",
  test: "Testing",
  security: "Security",
  remove: "Removed",
  delete: "Removed",
  deprecate: "Deprecated",
}

// Helper function to detect commit type from message
function detectCommitType(message) {
  const lowerMessage = message.toLowerCase()

  // Check for conventional commit format
  const conventionalMatch = message.match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\(.+\))?:/i
  )
  if (conventionalMatch) {
    return conventionalMatch[1].toLowerCase()
  }

  // Check for keywords in message
  for (const [type, section] of Object.entries(TYPE_MAPPINGS)) {
    if (lowerMessage.startsWith(type + ":") || lowerMessage.startsWith(type + " ")) {
      return type
    }
  }

  // Fallback: check for keywords anywhere in message
  for (const [type, section] of Object.entries(TYPE_MAPPINGS)) {
    if (
      lowerMessage.includes(type) &&
      (lowerMessage.includes("add") ||
        lowerMessage.includes("new") ||
        lowerMessage.includes("create"))
    ) {
      if (type === "add" || type === "create" || type === "new") return "feat"
    }
  }

  // Default to 'Changed' for misc/unclear commits
  return "chore"
}

// Get section name for commit type
function getSection(commitType) {
  const type = detectCommitType(commitType)
  return TYPE_MAPPINGS[type] || "Changed"
}

// Parse git log and get commits with dates and messages
function getCommits() {
  try {
    // Get all commits with full information
    const logFormat = "%H|%ad|%s|%b"
    const logOutput = execSync(`git log --pretty=format:"${logFormat}" --date=short --all`, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    })

    const commits = []
    const lines = logOutput.trim().split("\n")

    for (const line of lines) {
      if (!line.trim()) continue

      const parts = line.split("|")
      if (parts.length < 3) continue

      const [hash, date, subject, ...bodyParts] = parts
      const body = bodyParts.join("|").trim()

      // Skip merge commits and release commits
      if (
        subject.toLowerCase().includes("merge") ||
        subject.toLowerCase().includes("chore(release)") ||
        subject.toLowerCase().includes("update changelog")
      ) {
        continue
      }

      const fullMessage = body ? `${subject}\n\n${body}` : subject
      const section = getSection(subject)

      commits.push({
        hash: hash.substring(0, 7),
        fullHash: hash,
        date,
        subject,
        body,
        fullMessage,
        section,
        type: detectCommitType(subject),
      })
    }

    return commits
  } catch (error) {
    console.error("Error getting git commits:", error.message)
    return []
  }
}

// Get version tags
function getVersionTags() {
  try {
    const tags = execSync("git tag --sort=-version:refname", { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter((tag) => tag && (tag.startsWith("v") || /^\d+\.\d+\.\d+/.test(tag)))

    // Get dates for each tag
    const tagsWithDates = tags.map((tag) => {
      try {
        const date = execSync(`git log -1 --format=%ad --date=short ${tag}`, {
          encoding: "utf8",
        }).trim()
        return { tag, date }
      } catch {
        return { tag, date: null }
      }
    })

    return tagsWithDates
  } catch {
    return []
  }
}

// Group commits by version
function groupCommitsByVersion(commits, tags) {
  const grouped = {
    unreleased: [],
    versions: {},
  }

  // Sort tags by date (newest first)
  const sortedTags = [...tags].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date) - new Date(a.date)
  })

  // Get commits for each version
  for (let i = 0; i < sortedTags.length; i++) {
    const { tag, date } = sortedTags[i]
    const nextTag = i > 0 ? sortedTags[i - 1].tag : "HEAD"

    try {
      // Get commits between this tag and the next (newer) tag
      const range = i === 0 ? `${tag}..${nextTag}` : `${tag}..${nextTag}`
      const tagCommitsOutput = execSync(
        `git log --pretty=format:"%H" ${range} 2>/dev/null || true`,
        { encoding: "utf8" }
      ).trim()

      const tagCommits = tagCommitsOutput ? tagCommitsOutput.split("\n").filter(Boolean) : []

      grouped.versions[tag] = {
        date,
        commits: commits.filter((c) => tagCommits.includes(c.fullHash)),
      }
    } catch (error) {
      // Fallback: use date-based grouping
      try {
        const tagDate = date ? new Date(date) : null
        const nextTagDate =
          i > 0 && sortedTags[i - 1].date ? new Date(sortedTags[i - 1].date) : new Date()

        grouped.versions[tag] = {
          date,
          commits: commits.filter((c) => {
            const commitDate = new Date(c.date)
            if (tagDate && commitDate <= tagDate) {
              return i === 0 || commitDate > new Date(sortedTags[i - 1].date || 0)
            }
            return false
          }),
        }
      } catch {
        grouped.versions[tag] = { date, commits: [] }
      }
    }
  }

  // Find unreleased commits (commits after the latest tag)
  const versionedHashes = new Set()
  Object.values(grouped.versions).forEach((v) => {
    v.commits.forEach((c) => versionedHashes.add(c.fullHash))
  })

  // Unreleased = all commits not in any version
  grouped.unreleased = commits.filter((c) => !versionedHashes.has(c.fullHash))

  return grouped
}

// Format changelog entry
function formatEntry(commit) {
  let description = commit.subject

  // Add body if it exists and is meaningful
  if (commit.body && commit.body.trim()) {
    const bodyLines = commit.body.trim().split("\n")
    // Only include body if it adds meaningful information
    if (bodyLines.length > 0 && bodyLines[0].length > 0) {
      description = `${commit.subject}\n\n${bodyLines.map((line) => `  ${line}`).join("\n")}`
    }
  }

  return `- [${commit.date}] ${description} (${commit.hash})`
}

// Generate changelog content
function generateChangelog() {
  const commits = getCommits()
  const tags = getVersionTags()
  const grouped = groupCommitsByVersion(commits, tags)

  let changelog = `# Changelog

All notable changes to the My Race Engineer (MRE) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`

  // Unreleased section
  if (grouped.unreleased.length > 0) {
    changelog += `## [Unreleased]

`

    const unreleasedBySection = {}
    grouped.unreleased.forEach((commit) => {
      if (!unreleasedBySection[commit.section]) {
        unreleasedBySection[commit.section] = []
      }
      unreleasedBySection[commit.section].push(commit)
    })

    const sectionOrder = [
      "Added",
      "Changed",
      "Deprecated",
      "Removed",
      "Fixed",
      "Security",
      "Documentation",
      "Testing",
    ]
    sectionOrder.forEach((section) => {
      if (unreleasedBySection[section] && unreleasedBySection[section].length > 0) {
        changelog += `### ${section}

`
        unreleasedBySection[section]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .forEach((commit) => {
            changelog += formatEntry(commit) + "\n"
          })
        changelog += "\n"
      }
    })

    changelog += "---\n\n"
  }

  // Version sections
  const sortedTags = tags.sort((a, b) => {
    // Sort by date if available, otherwise by tag name
    if (a.date && b.date) {
      return new Date(b.date) - new Date(a.date)
    }
    return b.tag.localeCompare(a.tag)
  })

  for (const { tag, date } of sortedTags) {
    const version = tag.replace(/^v/, "")
    const versionData = grouped.versions[tag] || { date, commits: [] }

    if (versionData.commits.length === 0) continue

    changelog += `## [${version}] - ${date || "TBD"}

`

    const commitsBySection = {}
    versionData.commits.forEach((commit) => {
      if (!commitsBySection[commit.section]) {
        commitsBySection[commit.section] = []
      }
      commitsBySection[commit.section].push(commit)
    })

    const sectionOrder = [
      "Added",
      "Changed",
      "Deprecated",
      "Removed",
      "Fixed",
      "Security",
      "Documentation",
      "Testing",
    ]
    sectionOrder.forEach((section) => {
      if (commitsBySection[section] && commitsBySection[section].length > 0) {
        changelog += `### ${section}

`
        commitsBySection[section]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .forEach((commit) => {
            changelog += formatEntry(commit) + "\n"
          })
        changelog += "\n"
      }
    })

    changelog += "---\n\n"
  }

  // Add initial version if no tags exist
  if (tags.length === 0 && commits.length > 0) {
    const firstCommit = commits[commits.length - 1] // Oldest commit
    changelog += `## [${currentVersion}] - ${firstCommit.date}

`

    const commitsBySection = {}
    commits.forEach((commit) => {
      if (!commitsBySection[commit.section]) {
        commitsBySection[commit.section] = []
      }
      commitsBySection[commit.section].push(commit)
    })

    const sectionOrder = [
      "Added",
      "Changed",
      "Deprecated",
      "Removed",
      "Fixed",
      "Security",
      "Documentation",
      "Testing",
    ]
    sectionOrder.forEach((section) => {
      if (commitsBySection[section] && commitsBySection[section].length > 0) {
        changelog += `### ${section}

`
        commitsBySection[section]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .forEach((commit) => {
            changelog += formatEntry(commit) + "\n"
          })
        changelog += "\n"
      }
    })

    changelog += "---\n\n"
  }

  changelog += `## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

---

**End of Changelog**
`

  return changelog
}

// Main execution
try {
  const changelog = generateChangelog()
  fs.writeFileSync(CHANGELOG_FILE, changelog, "utf8")
  console.log(`✓ Changelog generated successfully at ${CHANGELOG_FILE}`)
} catch (error) {
  console.error("Error generating changelog:", error)
  process.exit(1)
}
