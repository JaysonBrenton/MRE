#!/usr/bin/env bash
#
# Create a zip of repository files the same way GitHub stores them: only
# tracked files at the given tree. Excludes:
#   - The .git directory (history, config, hooks)
#   - Paths matched by .gitignore (node_modules, .env, .next, coverage, etc.)
#   - Local untracked files and uncommitted edits (archive uses the committed tree)
#
# Implementation: git archive(1), which matches a fresh clone from GitHub.
#
# Usage:
#   ./scripts/zip-repo-for-github.sh
#   ./scripts/zip-repo-for-github.sh -o ~/Desktop/mre.zip
#   ./scripts/zip-repo-for-github.sh --ref origin/main
#   ./scripts/zip-repo-for-github.sh --no-prefix
#
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Error: not inside a git repository." >&2
  exit 1
}
cd "$REPO_ROOT"

REF="HEAD"
OUTPUT=""
CUSTOM_PREFIX=""
# true = top folder named like the repo; false = no --prefix (paths at zip root)
USE_TOP_DIR=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      cat <<'EOF'
Create a zip of tracked files only (same scope as GitHub), excluding gitignored
and untracked files.

Options:
  -o, --output PATH   Write zip here (default: <repo>/<name>-github-<short>-<date>.zip)
      --ref REF       Tree to archive (default: HEAD)
      --prefix NAME/  Root folder inside the zip (default: repository directory name)
      --no-prefix     No root folder; archive paths match the repo tree
EOF
      exit 0
      ;;
    --ref)
      REF="${2:?}"
      shift 2
      ;;
    -o | --output)
      OUTPUT="${2:?}"
      shift 2
      ;;
    --prefix)
      CUSTOM_PREFIX="${2:?}"
      USE_TOP_DIR=true
      shift 2
      ;;
    --no-prefix)
      USE_TOP_DIR=false
      shift
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
done

SHORT=$(git rev-parse --short "$REF" 2>/dev/null) || {
  echo "Error: invalid ref: $REF" >&2
  exit 1
}

REPO_NAME=$(basename "$REPO_ROOT")
DATE_STAMP=$(date +%Y%m%d)

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="${REPO_ROOT}/${REPO_NAME}-github-${SHORT}-${DATE_STAMP}.zip"
fi

ARCHIVE_ARGS=(--format=zip -o "$OUTPUT")

if [[ "$USE_TOP_DIR" == true ]]; then
  if [[ -n "$CUSTOM_PREFIX" ]]; then
    [[ "$CUSTOM_PREFIX" == */ ]] || CUSTOM_PREFIX="${CUSTOM_PREFIX}/"
    ARCHIVE_ARGS+=(--prefix="$CUSTOM_PREFIX")
  else
    ARCHIVE_ARGS+=(--prefix="${REPO_NAME}/")
  fi
fi

git archive "${ARCHIVE_ARGS[@]}" "$REF"

echo "Wrote: $OUTPUT"
echo "Contents: tracked files at $REF only (excludes gitignored and non-committed local files)."
