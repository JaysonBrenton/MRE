---
created: 2025-01-28
creator: System
lastModified: 2025-01-28
description: Pre-commit checklist for component creation
purpose:
  Quick reference checklist to run before committing any new or modified
  component
relatedFiles:
  - docs/development/FLEXBOX_LAYOUT_CHECKLIST.md
  - docs/development/PAGINATION_SPACING_GUIDELINES.md
---

# Component Creation Checklist

**Run this checklist before committing any component changes.**

## 🔴 Critical Checks (Must Pass)

### Pagination Components

- [ ] **Has `mb-16` (not `mb-8`) bottom margin** - See
      `docs/development/PAGINATION_SPACING_GUIDELINES.md`
- [ ] **Visually tested** - Scrolled to bottom of page and verified no footer
      overlap
- [ ] **Spacing documented** - Component header includes spacing notes

### Modal Components

- [ ] **Uses `src/components/ui/Modal.tsx`** OR `getModalContainerStyles()`
      utility
- [ ] **Not using Tailwind `w-full max-w-*` alone** in flex containers

### List/Table Components

- [ ] **Uses `src/components/ui/ListRow.tsx`** for list rows OR follows
      truncation patterns
- [ ] **Text truncation** implemented for long content

## ✅ General Checks

- [ ] Component follows naming conventions
- [ ] File header documentation is complete
- [ ] TypeScript types are properly defined
- [ ] Accessibility attributes included (aria-labels, roles, etc.)
- [ ] Tested with different content lengths
- [ ] No console errors or warnings
- [ ] Follows theme token system (no hardcoded colors)

## 📚 Reference Documentation

- **Layout issues:** `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md`
- **Pagination spacing:** `docs/development/PAGINATION_SPACING_GUIDELINES.md`
- **Component template:** `docs/development/PAGINATION_COMPONENT_TEMPLATE.md`
- **Architecture rules:**
  `docs/architecture/mobile-safe-architecture-guidelines.md`

## 🚨 Common Mistakes to Avoid

1. **Pagination with `mb-8` instead of `mb-16`** - This causes footer overlap
2. **Modal compression** - Using Tailwind classes alone in flex containers
3. **Missing text truncation** - Long text breaking layouts
4. **Hardcoded colors** - Not using theme tokens
5. **Missing accessibility** - No aria-labels or semantic HTML
