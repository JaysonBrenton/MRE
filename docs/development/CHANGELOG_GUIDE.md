# Changelog Management Guide

This document explains how the automated changelog system works and how to use
it.

## Overview

The My Race Engineer (MRE) project uses an automated changelog system that:

- Generates changelogs from git commit history
- Enforces conventional commit message format
- Automatically updates the changelog on merges
- Supports retrospective changelog generation

## How It Works

### 1. Conventional Commits

All commits must follow the
[Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New features (appears in "Added" section)
- `fix`: Bug fixes (appears in "Fixed" section)
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring (appears in "Changed" section)
- `perf`: Performance improvements (appears in "Changed" section)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (hidden from changelog)
- `build`: Build system changes (hidden from changelog)
- `ci`: CI configuration changes (hidden from changelog)

**Examples:**

```
feat: add driver filter to event search
fix: resolve authentication token expiration issue
perf: optimize database queries for event listing
docs: update API documentation
refactor: restructure event search component
```

### 2. Pre-commit Validation

Husky and commitlint automatically validate commit messages before they're
accepted. If your commit message doesn't follow the conventional format, the
commit will be rejected with an error message.

### 3. Automatic Changelog Updates

The changelog is automatically updated:

- **On PR merge**: GitHub Actions generates a new changelog entry
- **On release**: Running `npm run release` creates a new version entry

### 4. Manual Changelog Generation

You can manually generate or update the changelog:

```bash
# Generate changelog from git history
npm run changelog

# Generate retrospective changelog (includes all commits)
npm run changelog:retro
```

## Release Process

### Creating a New Release

1. **Make sure all changes are committed** with conventional commit messages

2. **Run the release command:**

   ```bash
   # Patch release (0.1.1 -> 0.1.2)
   npm run release:patch

   # Minor release (0.1.1 -> 0.2.0)
   npm run release:minor

   # Major release (0.1.1 -> 1.0.0)
   npm run release:major

   # Or let standard-version decide based on commit types
   npm run release
   ```

3. **What happens:**
   - Version is bumped in `package.json` and `package-lock.json`
   - Changelog is updated with a new version section
   - A git tag is created
   - A commit is made with the release changes

4. **Push the changes:**
   ```bash
   git push --follow-tags
   ```

## Retrospective Changelog Generation

If you need to generate a changelog from existing git history (for example, when
first setting up the system):

```bash
npm run changelog:retro
```

This script:

- Parses all git commits
- Categorizes them by type
- Generates a formatted changelog
- Uses `auto-changelog` for better formatting if available

## Configuration Files

- **`.versionrc.json`**: Configuration for `standard-version` (release
  management)
- **`.auto-changelog`**: Configuration for `auto-changelog` (changelog
  generation)
- **`commitlint.config.js`**: Rules for commit message validation
- **`.husky/commit-msg`**: Git hook that validates commit messages

## GitHub Actions

The `.github/workflows/update-changelog.yml` workflow:

- Runs on pushes to `main`/`master` branches
- Runs when PRs are merged
- Automatically updates the changelog
- Commits the updated changelog back to the repository

## Troubleshooting

### Commit Message Rejected

If your commit message is rejected, check:

1. Does it start with a valid type? (`feat`, `fix`, `docs`, etc.)
2. Is the type lowercase?
3. Is there a colon and space after the type?
4. Is the subject line under 100 characters?

Example of a valid commit:

```
feat: add new dashboard widget
```

### Changelog Not Updating

If the changelog isn't updating automatically:

1. Check that commits follow conventional format
2. Verify GitHub Actions workflow is enabled
3. Manually run `npm run changelog` to regenerate

### Need to Skip Validation

In rare cases, you may need to skip commit message validation:

```bash
git commit --no-verify -m "your message"
```

**Note:** Only use this for exceptional cases. Prefer fixing the commit message
format instead.

## Best Practices

1. **Write clear commit messages**: The subject line should clearly describe
   what changed
2. **Use scopes when helpful**: `feat(api): add user endpoint` is clearer than
   `feat: add user endpoint`
3. **Include breaking changes**: Use `!` after the type/scope:
   `feat!: change API response format`
4. **Keep commits focused**: One logical change per commit makes the changelog
   clearer
5. **Review the changelog**: Before releasing, review the generated changelog
   for accuracy

## Related Documentation

- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) - The format we
  follow
- [Semantic Versioning](https://semver.org/) - Version numbering strategy
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message
  specification
