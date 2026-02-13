---
created: 2025-01-28
creator: System
lastModified: 2026-01-26
description: Quick reference checklist for preventing flexbox layout bugs
purpose:
  Provides a quick reference checklist to prevent horizontal compression and
  layout breakage issues
relatedFiles:
  - docs/design/mre-mobile-ux-guidelines.md
  - src/components/molecules/Modal.tsx
  - src/components/atoms/ListRow.tsx
---

# Flexbox Layout Checklist

**Use this checklist before creating any modal, list, or flex container with
text content.**

## ✅ Pre-Development Checklist

Before writing code, ask:

- [ ] Can I use `src/components/molecules/Modal.tsx` instead of creating a
      custom modal?
- [ ] Can I use `src/components/atoms/ListRow.tsx` instead of creating custom
      list rows?
- [ ] Have I reviewed `docs/design/mre-mobile-ux-guidelines.md` Section 5.7?

## ✅ Modal Checklist

If creating a modal (even if using reusable component):

**Preferred approach:**

- [ ] **Use `src/components/molecules/Modal.tsx` component** - This handles all
      width constraints automatically

**If creating a custom modal (NOT RECOMMENDED):**

- [ ] **Use `getModalContainerStyles()` from `@/lib/modal-styles.ts`** - This
      provides the required inline styles
- [ ] Backdrop container has `min-w-0` inline style
- [ ] Modal container uses `getModalContainerStyles(maxWidth)` with appropriate
      maxWidth
- [ ] Modal container has `minWidth: '20rem'`, `flexShrink: 0`, `flexGrow: 0`
      (provided by utility)
- [ ] All sections (header, body, footer) have `min-w-0` and `width: 100%`
- [ ] Body container has `overflow-x-hidden` to prevent horizontal scroll
- [ ] **DO NOT rely on Tailwind classes alone** - they don't prevent flexbox
      compression
- [ ] Tested with long text content
- [ ] Tested on mobile viewport (375px width)

## ✅ List Row Checklist

If creating list rows with text and actions:

- [ ] Row container has `min-w-0` and `width: 100%` (or uses `ListRow`
      component)
- [ ] Text element has `min-w-0` and truncation styles (or uses `ListRowText`
      component)
- [ ] Action buttons/icons have `flex-shrink-0` (or uses `ListRowAction`
      component)
- [ ] Truncated text has `title` attribute for accessibility
- [ ] Tested with very long text content (100+ characters)
- [ ] Tested on mobile viewport (375px width)

## ✅ Pagination Component Checklist

If creating pagination components (chart, table, or list pagination):

- [ ] **CRITICAL: Component has `mb-16` (4rem / 64px minimum bottom margin) to
      prevent footer overlap**
- [ ] **DO NOT use `mb-8` - it's insufficient and will cause overlap**
- [ ] Component has appropriate top margin (`mt-4` or `mt-6`) to separate from
      content above
- [ ] **VISUALLY VERIFIED:** Scrolled to bottom of page and confirmed no overlap
      with footer
- [ ] If using ChartContainer, verified it has `pb-4` bottom padding
- [ ] See `docs/development/PAGINATION_SPACING_GUIDELINES.md` for complete
      requirements
- [ ] Tested with content that reaches the bottom of the viewport
- [ ] Verified no overlap with footer component
- [ ] Verified spacing is consistent across different content lengths
- [ ] See `docs/development/PAGINATION_SPACING_GUIDELINES.md` for complete
      guidelines

## ✅ Manual Implementation Checklist

If you must implement manually (not using reusable components):

**⚠️ CRITICAL: For modal containers in flex containers with
items-center/justify-center:**

- [ ] **USE `getModalContainerStyles()` from `@/lib/modal-styles.ts`** - This is
      the required pattern
- [ ] Modal container has `minWidth: '20rem'` (320px minimum)
- [ ] Modal container has `flexShrink: 0` and `flexGrow: 0` (prevents
      compression/expansion)
- [ ] Modal container has `width: '100%'` and appropriate `maxWidth` in rem
      units
- [ ] Modal container has `boxSizing: 'border-box'`
- [ ] **DO NOT use Tailwind classes `w-full max-w-*` alone** - they don't
      prevent compression

**For other flex containers:**

- [ ] All flex containers have `min-w-0` class AND inline style
      `{ minWidth: 0, width: '100%', boxSizing: 'border-box' }`
- [ ] All text elements have inline styles:
      `{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }`
- [ ] All action elements have inline style: `{ flexShrink: 0 }`
- [ ] Tested with long text content
- [ ] Tested on mobile viewport (375px width)
- [ ] Verified no horizontal scrolling occurs

## ✅ Centered Content with Flex (items-center/justify-center)

**⚠️ CRITICAL: Always specify `flex-col` when centering text content vertically.**

When using `flex items-center justify-center` to center content, forgetting `flex-col` causes width collapse and vertical text wrapping.

**The Problem:**

- You use `flex items-center justify-center` to center a message ✅
- You add a `max-w-md` inner container for text ✅
- But you forget `flex-col` to specify vertical stacking ❌
- Result: Content collapses to minimal width, text wraps vertically (one word per line)

**The Solution:**

- [ ] **Always add `flex-col`** when centering content blocks with text
- [ ] Add `w-full` to inner content containers to allow them to expand
- [ ] Test with real text content to verify proper width

**Example Pattern:**

```tsx
// ✅ CORRECT - flex-col ensures proper vertical stacking
<div className="flex flex-col items-center justify-center h-64 px-4">
  <div className="max-w-md w-full text-center">
    <p className="text-[var(--token-text-primary)] mb-2">
      User did not compete in this event.
    </p>
    <p className="text-[var(--token-text-secondary)]">
      You can find your events on the My Events page.
    </p>
  </div>
</div>

// ❌ WRONG - Missing flex-col causes width collapse
<div className="flex items-center justify-center h-64 text-center px-4">
  <div className="max-w-md">
    <p>This will wrap vertically!</p>
  </div>
</div>
```

**When to Apply:**

- Any centered content block with text (`flex items-center justify-center`)
- Empty states, loading messages, error messages
- Any time you're centering a message or content block

**Remember:** `items-center` alone can cause horizontal compression. Always pair with `flex-col` for vertical content layouts.

## ✅ Content Blocks in Scrollable Flex Containers

**⚠️ CRITICAL: This is the #2 cause of horizontal compression bugs. Read this
section carefully.**

When you create a scrollable flex layout (e.g., "form fixed, results scroll"),
you **MUST** add explicit width constraints to **all content blocks** inside the
scroll container, not just the container itself.

**The Problem:**

- You add `flex-1 min-h-0 overflow-y-auto` to create a scrollable section ✅
- You add `min-w-0` to allow flex shrinking ✅
- But you forget to add `minWidth` to **content blocks** (empty states,
  messages, etc.) ❌
- Result: Content collapses to 0 width, text wraps vertically, layout breaks

**The Solution:** Every content block inside a scrollable flex container needs
**inline styles** for width:

- [ ] **Scroll container** has inline
      `style={{ minWidth: '20rem', width: '100%', boxSizing: 'border-box' }}`
- [ ] **All flex parent chain** (modal body, padded divs, container root) have
      inline `minWidth: '20rem'` (or match modal's minWidth)
- [ ] **All content blocks** (empty states, loading messages, error messages)
      have inline
      `style={{ minWidth: '20rem', width: '100%', boxSizing: 'border-box' }}`
- [ ] **Inner content divs** (e.g., `max-w-md` containers) have inline
      `style={{ minWidth: '20rem', maxWidth: '28rem', width: '100%', boxSizing: 'border-box' }}`
- [ ] **DO NOT use Tailwind `w-full min-w-0` alone** - it will compress!
- [ ] **DO NOT assume "w-full = safe"** - if parent is 0 width, 100% of 0 is
      still 0

**Example Pattern:**

```tsx
// ✅ CORRECT - Using utility functions (PREFERRED)
import { getContentBlockStyles, getContentBlockStylesWithMax } from "@/lib/modal-styles"

<section
  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-6"
  style={getContentBlockStyles()}
>
  {/* Empty state wrapper - MUST have inline width */}
  <div className="py-8" style={getContentBlockStyles()}>
    {/* Inner content - MUST have inline width with max */}
    <div
      className="mx-auto px-4 space-y-3 text-center"
      style={getContentBlockStylesWithMax('28rem')}
    >
      <p>Content that won't compress</p>
    </div>
  </div>
</section>

// ✅ CORRECT - Manual inline styles (also acceptable)
<section
  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-6"
  style={{ minWidth: '20rem', width: '100%', boxSizing: 'border-box' }}
>
  <div
    className="py-8"
    style={{ minWidth: '20rem', width: '100%', boxSizing: 'border-box' }}
  >
    <div
      className="mx-auto px-4 space-y-3 text-center"
      style={{
        minWidth: '20rem',
        maxWidth: '28rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <p>Content that won't compress</p>
    </div>
  </div>
</section>

// ❌ WRONG - Tailwind only, will compress to 0 width!
<section className="flex-1 min-h-0 overflow-y-auto min-w-0">
  <div className="py-8 w-full min-w-0">
    <div className="mx-auto max-w-md px-2">
      <p>This will compress!</p>
    </div>
  </div>
</section>
```

**When to Apply:**

- Any scrollable flex container (`overflow-y-auto` or `overflow-y-scroll`)
- Any content block inside a flex layout (empty states, loading states,
  messages)
- Any nested flex column layout (modal → body → container → section)
- Any time you use `min-w-0` - you MUST also add a positive `minWidth` somewhere
  in the chain

**Remember:** The flexbox checklist says "DO NOT rely on Tailwind classes
alone" - this applies to **content blocks** too, not just containers!

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
- **Text wraps vertically (one word per line) in empty states or messages** ⚠️
  **Most common flex compression bug - check for missing `flex-col`**
- **Content blocks have width: 0px or very narrow (12px) in browser inspector** ⚠️ 
  **Check for missing `flex-col` or inline width styles**
- Pagination controls appear too close to footer
- Footer overlaps pagination controls

## 📚 Quick Reference

**Reusable Components:**

- Modals: `src/components/molecules/Modal.tsx`
- List Rows: `src/components/atoms/ListRow.tsx`
- Page Containers: `src/components/molecules/PageContainer.tsx`
- Content Wrappers: `src/components/molecules/ContentWrapper.tsx`
- Pagination: `src/components/organisms/event-analysis/ChartPagination.tsx`
  (reference implementation)

**Width Style Utilities:**

- Modal containers: `getModalContainerStyles(maxWidth)` from
  `@/lib/modal-styles`
- Content blocks: `getContentBlockStyles(minWidth?)` from `@/lib/modal-styles`
- Content blocks with max: `getContentBlockStylesWithMax(maxWidth, minWidth?)`
  from `@/lib/modal-styles`

**Documentation:**

- Full guidelines: `docs/design/mre-mobile-ux-guidelines.md` Section 5.7
- Architecture rules: `docs/architecture/mobile-safe-architecture-guidelines.md`
  Section 6
- Pagination spacing: `docs/development/PAGINATION_SPACING_GUIDELINES.md`

**Common Patterns:**

```tsx
// ✅ Modal with reusable component (PREFERRED)
import Modal from "@/components/molecules/Modal"
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
import ListRow, { ListRowText, ListRowAction } from "@/components/atoms/ListRow"
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
