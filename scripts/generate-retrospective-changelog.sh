#!/bin/bash

# Generate retrospective changelog from git history
# This script parses git commits and generates a changelog entry

set -e

CHANGELOG_FILE="docs/development/CHANGELOG.md"
TEMP_FILE=$(mktemp)

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not in a git repository"
  exit 1
fi

# Get the first commit date or use a default
FIRST_COMMIT_DATE=$(git log --reverse --format="%ad" --date=short | head -n 1)
if [ -z "$FIRST_COMMIT_DATE" ]; then
  FIRST_COMMIT_DATE=$(date +%Y-%m-%d)
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "# Changelog" > "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "All notable changes to the My Race Engineer (MRE) project will be documented in this file." >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)," >> "$TEMP_FILE"
echo "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)." >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "## [Unreleased]" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Added" >> "$TEMP_FILE"
echo "- Placeholder for future features" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Changed" >> "$TEMP_FILE"
echo "- Placeholder for future changes" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Deprecated" >> "$TEMP_FILE"
echo "- Placeholder for future deprecations" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Removed" >> "$TEMP_FILE"
echo "- Placeholder for future removals" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Fixed" >> "$TEMP_FILE"
echo "- Placeholder for future fixes" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Security" >> "$TEMP_FILE"
echo "- Placeholder for future security updates" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "---" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# Generate version entry
echo "## [$CURRENT_VERSION] - $FIRST_COMMIT_DATE" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# Categorize commits
echo "### Added" >> "$TEMP_FILE"
git log --pretty=format:"- %s (%h)" --grep="^feat" --grep="^add" --grep="^create" -i --all >> "$TEMP_FILE" 2>/dev/null || echo "- No new features" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

echo "### Fixed" >> "$TEMP_FILE"
git log --pretty=format:"- %s (%h)" --grep="^fix" --grep="^bug" -i --all >> "$TEMP_FILE" 2>/dev/null || echo "- No bug fixes" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

echo "### Changed" >> "$TEMP_FILE"
git log --pretty=format:"- %s (%h)" --grep="^refactor" --grep="^perf" --grep="^update" --grep="^change" --grep="^improve" -i --all >> "$TEMP_FILE" 2>/dev/null || echo "- No changes" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

echo "### Documentation" >> "$TEMP_FILE"
git log --pretty=format:"- %s (%h)" --grep="^docs" --grep="^doc" -i --all >> "$TEMP_FILE" 2>/dev/null || echo "- No documentation changes" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

echo "---" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "## Types of Changes" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "- **Added** for new features" >> "$TEMP_FILE"
echo "- **Changed** for changes in existing functionality" >> "$TEMP_FILE"
echo "- **Deprecated** for soon-to-be removed features" >> "$TEMP_FILE"
echo "- **Removed** for now removed features" >> "$TEMP_FILE"
echo "- **Fixed** for any bug fixes" >> "$TEMP_FILE"
echo "- **Security** for vulnerability fixes" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "---" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "**End of Changelog**" >> "$TEMP_FILE"

# Use auto-changelog for better formatting if available
if command -v npx &> /dev/null; then
  echo "Using auto-changelog for better formatting..."
  npx auto-changelog --template keepachangelog --output "$CHANGELOG_FILE" --starting-version "$CURRENT_VERSION" || mv "$TEMP_FILE" "$CHANGELOG_FILE"
else
  mv "$TEMP_FILE" "$CHANGELOG_FILE"
fi

echo "Retrospective changelog generated at $CHANGELOG_FILE"

