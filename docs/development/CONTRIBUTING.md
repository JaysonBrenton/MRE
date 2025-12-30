---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Contributing guidelines for MRE project
purpose: Provides comprehensive contributing guidelines including code of conduct, development
         workflow, branch naming, commit messages, pull request process, code review guidelines,
         testing requirements, and release process. Standardizes contribution process and
         improves code quality.
relatedFiles:
  - docs/standards/file-headers-and-commenting-guidelines.md (code standards)
  - docs/roles/ (role responsibilities)
  - docs/adr/README.md (ADR process)
  - README.md (project overview)
---

# Contributing Guidelines

**Last Updated:** 2025-01-27  
**Welcome!** Thank you for your interest in contributing to My Race Engineer (MRE).

This document provides guidelines for contributing to the MRE project. Please read this before submitting contributions.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Development Workflow](#development-workflow)
3. [Branch Naming Conventions](#branch-naming-conventions)
4. [Commit Message Guidelines](#commit-message-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Code Review Guidelines](#code-review-guidelines)
7. [Testing Requirements](#testing-requirements)
8. [Documentation Requirements](#documentation-requirements)
9. [Release Process](#release-process)
10. [How to Report Bugs](#how-to-report-bugs)
11. [How to Propose Features](#how-to-propose-features)

---

## Code of Conduct

### Our Standards

- **Be respectful** - Treat all contributors with respect
- **Be inclusive** - Welcome contributors of all backgrounds
- **Be constructive** - Provide helpful feedback
- **Be professional** - Maintain professional communication

### Unacceptable Behavior

- Harassment or discrimination
- Personal attacks
- Trolling or inflammatory comments
- Other conduct that could reasonably be considered inappropriate

---

## Development Workflow

### Getting Started

1. **Read the Documentation**
   - [Quick Start Guide](./quick-start.md) - Setup instructions
   - [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - Architecture rules
   - [Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) - Feature scope

2. **Set Up Development Environment**
   - Follow [Quick Start Guide](./quick-start.md)
   - Verify all services are running
   - Run tests to verify setup

3. **Choose a Task**
   - Check existing issues
   - Discuss feature proposals before starting
   - Ensure task aligns with Alpha scope

### Development Process

1. **Create a Branch**
   - Use descriptive branch names (see [Branch Naming](#branch-naming-conventions))
   - Create branch from `main`

2. **Make Changes**
   - Follow architecture guidelines
   - Write tests
   - Update documentation
   - Follow code standards

3. **Test Your Changes**
   - Run all tests
   - Test manually
   - Verify no regressions

4. **Submit Pull Request**
   - Follow [Pull Request Process](#pull-request-process)
   - Wait for code review
   - Address feedback

---

## Branch Naming Conventions

### Format

```
<type>/<description>
```

### Types

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

### Examples

```
feature/user-profile-page
fix/login-error-handling
docs/api-reference-update
refactor/auth-service
test/user-registration-tests
chore/update-dependencies
```

---

## Commit Message Guidelines

### Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Test additions/changes
- `chore` - Maintenance tasks

### Examples

```
feat: add user profile page

Implements user profile page with driver name and team name display.
Follows mobile-safe architecture guidelines.

Closes #123
```

```
fix: handle database connection errors

Adds proper error handling for database connection failures.
Returns appropriate error codes to clients.

Fixes #456
```

### Guidelines

- Use imperative mood ("add" not "added")
- Keep subject line under 50 characters
- Capitalize first letter of subject
- No period at end of subject
- Reference issues in footer

---

## Pull Request Process

### Before Submitting

- [ ] Code follows architecture guidelines
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Code reviewed by yourself
- [ ] No console.logs or debug code
- [ ] File headers compliant

### Pull Request Template

**Title:** Clear, descriptive title

**Description:**
- What changes are made
- Why changes are needed
- How to test
- Related issues

**Checklist:**
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Architecture guidelines followed
- [ ] No breaking changes (or ADR created)

### Review Process

1. **Automated Checks**
   - Linting
   - Type checking
   - Tests
   - Build

2. **Code Review**
   - At least one approval required
   - Address all feedback
   - Update PR as needed

3. **Merge**
   - Squash and merge (recommended)
   - Delete branch after merge

---

## Code Review Guidelines

### For Reviewers

**Focus On:**
- Architecture compliance
- Code quality
- Test coverage
- Documentation
- Security concerns

**Be Constructive:**
- Provide specific feedback
- Suggest improvements
- Explain reasoning
- Be respectful

### For Authors

**Respond To:**
- All review comments
- Questions
- Suggestions

**Update PR:**
- Address feedback
- Update code as needed
- Re-request review when ready

---

## Testing Requirements

### Required Tests

- **Unit Tests** - For new business logic
- **Integration Tests** - For new API endpoints
- **E2E Tests** - For critical user flows (if applicable)

### Test Coverage

- **Minimum:** Critical paths covered
- **Target:** 80%+ for new code
- **Required:** All public APIs tested

### Running Tests

```bash
# Python ingestion service
cd ingestion
pytest

# Next.js application (when implemented)
npm test
```

**See:** [Testing Strategy](./testing-strategy.md) for detailed testing guidelines.

---

## Documentation Requirements

### Required Documentation

- **Code Comments** - JSDoc for public APIs
- **File Headers** - All files must have headers
- **README Updates** - If user-facing changes
- **API Documentation** - If API changes

### Documentation Standards

**See:** [File Headers and Commenting Guidelines](../standards/file-headers-and-commenting-guidelines.md)

**Key Points:**
- All files must have headers
- Public APIs must have JSDoc
- Complex logic must have comments
- Update documentation with code changes

---

## Release Process

**Placeholder:** Release process will be documented

### Release Steps

1. **Prepare Release**
   - Update version numbers
   - Update CHANGELOG.md
   - Create release branch

2. **Test Release**
   - Run full test suite
   - Manual testing
   - Verify documentation

3. **Deploy Release**
   - Deploy to staging
   - Verify staging
   - Deploy to production

4. **Post-Release**
   - Monitor for issues
   - Update documentation
   - Announce release

---

## How to Report Bugs

### Bug Report Template

**Title:** Clear, descriptive title

**Description:**
- What happened
- Expected behavior
- Steps to reproduce
- Environment details

**Additional Info:**
- Screenshots (if applicable)
- Error messages
- Logs (if applicable)

### Where to Report

- Create issue in repository
- Use "bug" label
- Provide all requested information

---

## How to Propose Features

### Feature Proposal Template

**Title:** Clear, descriptive title

**Description:**
- What feature is proposed
- Why it's needed
- How it would work
- Alternatives considered

### Before Proposing

1. **Check Alpha Scope**
   - Ensure feature is in scope
   - Or create ADR if out of scope

2. **Discuss First**
   - Open discussion issue
   - Get feedback
   - Refine proposal

3. **Create ADR (if needed)**
   - For architectural changes
   - Follow ADR format

**See:** [ADR Guidelines](../adr/README.md) for when ADRs are required.

---

## Architecture Compliance

### Must Follow

- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
- [Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md)
- [File Headers Standards](../standards/file-headers-and-commenting-guidelines.md)

### Architecture Violations

If your change violates architecture guidelines:

1. **Create ADR** - Document the deviation
2. **Get Approval** - ADR must be accepted
3. **Update Guidelines** - If pattern becomes standard

---

## Role-Based Development

MRE uses role-based development. See role documentation in `docs/roles/`:

- **TypeScript Domain Engineer** - Business logic
- **Next.js Front-End Engineer** - UI components
- **Prisma/PostgreSQL Backend Engineer** - Database
- **Quality & Automation Engineer** - Testing
- **Documentation & Knowledge Steward** - Documentation

**Understand your role responsibilities before contributing.**

---

## Related Documentation

- [Quick Start Guide](./quick-start.md) - Development setup
- [Testing Strategy](./testing-strategy.md) - Testing guidelines
- [File Headers Standards](../standards/file-headers-and-commenting-guidelines.md) - Code standards
- [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - Architecture rules
- [ADR Guidelines](../adr/README.md) - Architecture decision process

---

**Thank you for contributing to MRE!**

**End of Contributing Guidelines**

