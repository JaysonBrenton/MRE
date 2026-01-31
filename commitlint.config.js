module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // Added - New features
        "fix", // Fixed - Bug fixes
        "docs", // Documentation - Documentation changes
        "style", // Changed - Code style changes (formatting, missing semicolons, etc.)
        "refactor", // Changed - Code refactoring
        "perf", // Changed - Performance improvements
        "test", // Testing - Adding or updating tests
        "build", // Build system or external dependencies
        "ci", // CI configuration files and scripts
        "chore", // Maintenance - Other changes that don't modify src or test files
        "revert", // Reverted - Reverts a previous commit
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [1, "always"],
  },
}
