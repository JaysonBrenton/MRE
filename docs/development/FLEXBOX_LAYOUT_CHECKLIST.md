---
created: 2025-01-28
creator: System
lastModified: 2025-01-28
description: Quick reference checklist for preventing flexbox layout bugs
purpose: Provides a quick reference checklist to prevent horizontal compression and layout breakage issues
relatedFiles:
  - docs/design/mre-mobile-ux-guidelines.md
  - src/components/ui/Modal.tsx
  - src/components/ui/ListRow.tsx
---

# Flexbox Layout Checklist

**Use this checklist before creating any modal, list, or flex container with text content.**

## ✅ Pre-Development Checklist

Before writing code, ask:

- [ ] Can I use `src/components/ui/Modal.tsx` instead of creating a custom modal?
- [ ] Can I use `src/components/ui/ListRow.tsx` instead of creating custom list rows?
- [ ] Have I reviewed `docs/design/mre-mobile-ux-guidelines.md` Section 5.7?

## ✅ Modal Checklist

If creating a modal (even if using reusable component):

**Preferred approach:**
- [ ] **Use `src/components/ui/Modal.tsx` component** - This handles all width constraints automatically

**If creating a custom modal (NOT RECOMMENDED):**
- [ ] **Use `getModalContainerStyles()` from `@/lib/modal-styles.ts`** - This provides the required inline styles
- [ ] Backdrop container has `min-w-0` inline style
- [ ] Modal container uses `getModalContainerStyles(maxWidth)` with appropriate maxWidth
- [ ] Modal container has `minWidth: '20rem'`, `flexShrink: 0`, `flexGrow: 0` (provided by utility)
- [ ] All sections (header, body, footer) have `min-w-0` and `width: 100%`
- [ ] Body container has `overflow-x-hidden` to prevent horizontal scroll
- [ ] **DO NOT rely on Tailwind classes alone** - they don't prevent flexbox compression
- [ ] Tested with long text content
- [ ] Tested on mobile viewport (375px width)

## ✅ List Row Checklist

If creating list rows with text and actions:

- [ ] Row container has `min-w-0` and `width: 100%` (or uses `ListRow` component)
- [ ] Text element has `min-w-0` and truncation styles (or uses `ListRowText` component)
- [ ] Action buttons/icons have `flex-shrink-0` (or uses `ListRowAction` component)
- [ ] Truncated text has `title` attribute for accessibility
- [ ] Tested with very long text content (100+ characters)
- [ ] Tested on mobile viewport (375px width)

## ✅ Pagination Component Checklist

If creating pagination components (chart, table, or list pagination):

- [ ] **CRITICAL: Component has `mb-16` (4rem / 64px minimum bottom margin) to prevent footer overlap**
- [ ] **DO NOT use `mb-8` - it's insufficient and will cause overlap**
- [ ] Component has appropriate top margin (`mt-4` or `mt-6`) to separate from content above
- [ ] **VISUALLY VERIFIED:** Scrolled to bottom of page and confirmed no overlap with footer
- [ ] If using ChartContainer, verified it has `pb-4` bottom padding
- [ ] See `docs/development/PAGINATION_SPACING_GUIDELINES.md` for complete requirements
- [ ] Tested with content that reaches the bottom of the viewport
- [ ] Verified no overlap with footer component
- [ ] Verified spacing is consistent across different content lengths
- [ ] See `docs/development/PAGINATION_SPACING_GUIDELINES.md` for complete guidelines

## ✅ Manual Implementation Checklist

If you must implement manually (not using reusable components):

**⚠️ CRITICAL: For modal containers in flex containers with items-center/justify-center:**
- [ ] **USE `getModalContainerStyles()` from `@/lib/modal-styles.ts`** - This is the required pattern
- [ ] Modal container has `minWidth: '20rem'` (320px minimum)
- [ ] Modal container has `flexShrink: 0` and `flexGrow: 0` (prevents compression/expansion)
- [ ] Modal container has `width: '100%'` and appropriate `maxWidth` in rem units
- [ ] Modal container has `boxSizing: 'border-box'`
- [ ] **DO NOT use Tailwind classes `w-full max-w-*` alone** - they don't prevent compression

**For other flex containers:**
- [ ] All flex containers have `min-w-0` class AND inline style `{ minWidth: 0, width: '100%', boxSizing: 'border-box' }`
- [ ] All text elements have inline styles: `{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }`
- [ ] All action elements have inline style: `{ flexShrink: 0 }`
- [ ] Tested with long text content
- [ ] Tested on mobile viewport (375px width)
- [ ] Verified no horizontal scrolling occurs

## ✅ Testing Checklist

Before considering the feature complete:

- [ ] Tested with short text (< 20 characters)
- [ ] Tested with medium text (20-50 characters)
- [ ] Tested with long text (50-100 characters)
- [ ] Tested with very long text (100+ characters)
- [ ] Tested on desktop viewport (1920px width)
- [ ] Tested on tablet viewport (768px width)
- [ ] Tested on mobile viewport (375px width)
- [ ] Verified no horizontal scrolling
- [ ] Verified text truncates with ellipsis (...)
- [ ] Verified action buttons/icons remain visible and clickable

## 🚨 Red Flags

If you see any of these, you have a layout bug:

- Modal appears compressed horizontally
- List items are unreadable
- Buttons/icons are pushed off-screen
- Horizontal scrolling appears unexpectedly
- Text overlaps with buttons/icons
- Content appears as a thin grey bar
- Pagination controls appear too close to footer
- Footer overlaps pagination controls

## 📚 Quick Reference

**Reusable Components:**
- Modals: `src/components/ui/Modal.tsx`
- List Rows: `src/components/ui/ListRow.tsx`
- Page Containers: `src/components/layout/PageContainer.tsx`
- Content Wrappers: `src/components/layout/ContentWrapper.tsx`
- Pagination: `src/components/event-analysis/ChartPagination.tsx` (reference implementation)

**Documentation:**
- Full guidelines: `docs/design/mre-mobile-ux-guidelines.md` Section 5.7
- Architecture rules: `docs/architecture/mobile-safe-architecture-guidelines.md` Section 6
- Pagination spacing: `docs/development/PAGINATION_SPACING_GUIDELINES.md`

**Common Patterns:**

```tsx
// ✅ Modal with reusable component (PREFERRED)
import Modal from "@/components/ui/Modal"
<Modal isOpen={isOpen} onClose={handleClose} title="Title">
  {content}
</Modal>

// ✅ Custom modal with shared styles utility (if absolutely necessary)
import { getModalContainerStyles, MODAL_MAX_WIDTHS } from "@/lib/modal-styles"
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
  <div style={getModalContainerStyles(MODAL_MAX_WIDTHS.md)}>
    {modal content}
  </div>
</div>

// ❌ WRONG - Don't use Tailwind classes alone (will compress!)
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="w-full max-w-md">  {/* This will compress! */}
    {modal content}
  </div>
</div>

// ✅ List row with reusable components
import ListRow, { ListRowText, ListRowAction } from "@/components/ui/ListRow"
<ListRow onClick={handleClick}>
  <ListRowText title={fullText}>{text}</ListRowText>
  <ListRowAction><button>Action</button></ListRowAction>
</ListRow>

// ✅ Pagination with proper spacing (REQUIRED - mb-16 minimum)
<nav className="flex items-center justify-between gap-4 mt-4 mb-16 px-2">
  {/* pagination controls */}
</nav>

// ❌ WRONG - Missing bottom margin (will overlap with footer!)
<nav className="flex items-center justify-between gap-4 mt-4 px-2">
  {/* pagination controls */}
</nav>

// ❌ WRONG - Insufficient bottom margin (mb-8 is not enough!)
<nav className="flex items-center justify-between gap-4 mt-4 mb-8 px-2">
  {/* pagination controls */}
</nav>
```

