---
created: 2026-01-05
creator: Jayson Brenton
lastModified: 2026-01-05
description: Central index for all style guides and coding standards
purpose:
  Provides a single entry point to all style guides, coding standards, and
  formatting rules for the MRE project. Helps developers and AI assistants
  quickly find the relevant style guidelines for their work.
relatedFiles:
  - docs/standards/file-headers-and-commenting-guidelines.md
  - docs/standards/typescript-react-style-guide.md
  - docs/development/CONTRIBUTING.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# Style Guides and Standards Index

**Last updated:** 2026-01-05  
**Purpose:** Central reference for all coding standards and style guides

This directory contains all style guides and coding standards for the MRE
project. Use this index to quickly find the relevant guidelines for your work.

---

## 📋 Quick Navigation

### Code Style

- **[File Headers & Commenting](./file-headers-and-commenting-guidelines.md)**  
  Mandatory standards for file headers and code documentation

- **[TypeScript & React Style Guide](./typescript-react-style-guide.md)**  
  Comprehensive coding standards for TypeScript and React development

### Design Style

- **[UX Principles](../design/mre-ux-principles.md)**  
  User experience principles and patterns

- **[Dark Theme Guidelines](../design/mre-dark-theme-guidelines.md)**  
  Visual design standards and token system

### Workflow & Process

- **[Contributing Guidelines](../development/CONTRIBUTING.md)**  
  Development workflow, commit messages, and pull request process

- **[Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)**  
  Architectural
  principles and folder structure requirements

### Configuration Files

- **[Prettier Configuration](../../.prettierrc)**  
  Code formatting rules and file-specific overrides

- **[EditorConfig](../../.editorconfig)**  
  Editor settings for consistent formatting

- **[ESLint Configuration](../../eslint.config.mjs)**  
  Code quality and linting rules

---

## 🎯 Style Guide Overview

### Code Style Standards

#### File Headers and Commenting

**Location:** `file-headers-and-commenting-guidelines.md`

**Covers:**

- Required file header format by file type
- JSDoc standards for functions and classes
- Inline commenting guidelines
- Maintenance requirements

**When to use:** Creating or modifying any file in the project

#### TypeScript and React Patterns

**Location:** `typescript-react-style-guide.md`

**Covers:**

- Naming conventions (files, variables, functions, components)
- TypeScript patterns (type vs interface, utility types)
- React component patterns (server vs client)
- Import organization
- Code structure and organization

**When to use:** Writing TypeScript or React code

### Design Standards

#### UX Principles

**Location:** `../design/mre-ux-principles.md`

**Covers:**

- UX laws and patterns
- Form design standards
- Button styling requirements
- Content tone and microcopy

**When to use:** Designing or implementing UI components

#### Dark Theme Guidelines

**Location:** `../design/mre-dark-theme-guidelines.md`

**Covers:**

- Semantic token system (`--token-*`)
- Typography rules
- Spacing scale
- Color and contrast requirements

**When to use:** Styling components or creating new UI elements

### Workflow Standards

#### Contributing Guidelines

**Location:** `../development/CONTRIBUTING.md`

**Covers:**

- Development workflow
- Branch naming conventions
- Commit message format
- Pull request process
- Code review guidelines

**When to use:** Contributing code or reviewing pull requests

#### Architecture Guidelines

**Location:** `../architecture/mobile-safe-architecture-guidelines.md`

**Covers:**

- API-first backend principles
- Folder structure requirements
- Separation of concerns
- Database access patterns

**When to use:** Designing features or reviewing architecture

---

## 🛠️ Configuration Files

### Prettier (`.prettierrc`)

Code formatting configuration:

- No semicolons
- Double quotes
- 2-space indentation
- 100 character line width
- File-specific overrides for Markdown, JSON, YAML

**Usage:**

```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

### EditorConfig (`.editorconfig`)

Editor settings for consistent formatting:

- UTF-8 encoding
- LF line endings
- 2-space indentation (4 for Python)
- Trim trailing whitespace

**Usage:** Automatically applied by most editors

### ESLint (`eslint.config.mjs`)

Code quality and linting:

- Next.js recommended rules
- TypeScript rules
- Prettier integration (no conflicts)

**Usage:**

```bash
npm run lint  # Run linting
```

---

## 📚 Additional Resources

### Component Development

- **[Component Creation Checklist](../development/COMPONENT_CREATION_CHECKLIST.md)**  
  Pre-commit
  checklist for component development

- **[Flexbox Layout Checklist](../development/FLEXBOX_LAYOUT_CHECKLIST.md)**  
  Layout guidelines and common issues

- **[Pagination Spacing Guidelines](../development/PAGINATION_SPACING_GUIDELINES.md)**  
  Spacing
  standards for pagination components

### Testing

- **[Testing Strategy](../development/testing-strategy.md)**  
  Testing guidelines and requirements

### Documentation

- **[Quick Start Guide](../development/quick-start.md)**  
  Development environment setup

---

## 🚀 Getting Started

### For New Contributors

1. **Read the Architecture Guidelines**  
   Understand the project structure and principles

2. **Review the Contributing Guidelines**  
   Learn the development workflow

3. **Study the TypeScript/React Style Guide**  
   Understand coding standards

4. **Check the File Headers Guide**  
   Learn how to document your code

5. **Set up your editor**  
   Configure Prettier and EditorConfig

### For AI Assistants

When creating or modifying code:

1. **Always include file headers** (see
   file-headers-and-commenting-guidelines.md)
2. **Follow TypeScript/React patterns** (see typescript-react-style-guide.md)
3. **Use semantic tokens** (see mre-dark-theme-guidelines.md)
4. **Format code with Prettier** before completing
5. **Follow import organization** rules

---

## 📝 Style Guide Maintenance

Style guides are living documents. When updating:

1. Update the `lastModified` date in the frontmatter
2. Document the change in the guide itself
3. Update this index if structure changes
4. Communicate significant changes to the team

---

## 🔗 Related Documentation

- [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
- [UX Principles](../design/mre-ux-principles.md)
- [Contributing Guidelines](../development/CONTRIBUTING.md)
- [Role Documentation](../roles/)

---

**End of Style Guides Index**
