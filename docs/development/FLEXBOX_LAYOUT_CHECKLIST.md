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

- [ ] Backdrop container has `min-w-0` (or uses `Modal` component)
- [ ] Modal container has explicit width constraints (`min-w-0`, `width: 100%`, `max-width`)
- [ ] All sections (header, body, footer) have `min-w-0` and `width: 100%`
- [ ] Body container has `overflow-x-hidden` to prevent horizontal scroll
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

## ✅ Manual Implementation Checklist

If you must implement manually (not using reusable components):

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

## 📚 Quick Reference

**Reusable Components:**
- Modals: `src/components/ui/Modal.tsx`
- List Rows: `src/components/ui/ListRow.tsx`
- Page Containers: `src/components/layout/PageContainer.tsx`
- Content Wrappers: `src/components/layout/ContentWrapper.tsx`

**Documentation:**
- Full guidelines: `docs/design/mre-mobile-ux-guidelines.md` Section 5.7
- Architecture rules: `docs/architecture/mobile-safe-architecture-guidelines.md` Section 6

**Common Patterns:**

```tsx
// ✅ Modal with reusable component
import Modal from "@/components/ui/Modal"
<Modal isOpen={isOpen} onClose={handleClose} title="Title">
  {content}
</Modal>

// ✅ List row with reusable components
import ListRow, { ListRowText, ListRowAction } from "@/components/ui/ListRow"
<ListRow onClick={handleClick}>
  <ListRowText title={fullText}>{text}</ListRowText>
  <ListRowAction><button>Action</button></ListRowAction>
</ListRow>
```

