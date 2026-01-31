---
created: 2025-01-28
creator: System
lastModified: 2025-01-28
description: Template comment block for pagination components
purpose:
  Provides a standardized comment template to copy when creating new pagination
  components
relatedFiles:
  - src/components/event-analysis/ChartPagination.tsx
  - docs/development/PAGINATION_SPACING_GUIDELINES.md
---

# Pagination Component Template

When creating a new pagination component, copy this template and ensure all
spacing requirements are met.

## Component File Header Template

```tsx
/**
 * @fileoverview [Component Name] pagination component
 *
 * @created [Date]
 * @creator [Your Name]
 * @lastModified [Date]
 *
 * @description Pagination controls for [description]
 *
 * @purpose Provides navigation controls for paginated [content type] views.
 *          Optimized for desktop viewports.
 *
 * @spacing CRITICAL: This component includes `mb-16` bottom margin to prevent footer overlap.
 *          See docs/development/PAGINATION_SPACING_GUIDELINES.md for spacing requirements.
 *          DO NOT use `mb-8` - it's insufficient and will cause overlap.
 *
 * @relatedFiles
 * - [Component that uses this]
 * - docs/development/PAGINATION_SPACING_GUIDELINES.md (spacing requirements)
 * - src/components/event-analysis/ChartPagination.tsx (reference implementation)
 */
```

## Root Element Template

```tsx
return (
  <nav
    className="flex items-center justify-between gap-4 mt-4 mb-16 px-2"
    //                                                      ^^^^^^
    //                                                      CRITICAL: mb-16 (not mb-8!)
    aria-label="[Content type] pagination"
  >
    {/* pagination controls */}
  </nav>
)
```

## Checklist Before Committing

- [ ] Root element has `mb-16` (4rem / 64px) bottom margin
- [ ] Root element has appropriate top margin (`mt-4` or `mt-6`)
- [ ] Component file header includes spacing documentation
- [ ] Visually tested by scrolling to bottom of page
- [ ] Verified no overlap with footer component
- [ ] Tested with different content lengths
- [ ] If using ChartContainer, verified it has `pb-4` bottom padding

## Common Mistakes

❌ **WRONG:**

```tsx
<nav className="flex items-center justify-between gap-4 mt-4 mb-8 px-2">
```

✅ **CORRECT:**

```tsx
<nav className="flex items-center justify-between gap-4 mt-4 mb-16 px-2">
```
