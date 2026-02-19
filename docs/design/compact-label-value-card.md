---
created: 2026-02-16
creator: Jayson Brenton
lastModified: 2026-02-16
description: Design standard for compact single-card label: value layouts
purpose:
  Ensures consistent text alignment and layout when building small summary cards
  that display multiple label: value rows (e.g. event stats, entity summaries).
relatedFiles:
  - src/components/organisms/event-analysis/EventStats.tsx
  - src/components/organisms/event-analysis/WeatherCard.tsx
  - docs/architecture/atomic-design-system.md
---

# Compact Label–Value Card Design Standard

**Status:** Authoritative  
**Scope:** Any card that displays multiple "Label: value" rows in a compact, single-card layout  
**Applies to:** All contributors (human and LLM)

Use this standard whenever you add a **compact summary card** that shows several label: value pairs (e.g. Total Races: 21, Total Drivers: 25). Following it keeps alignment and density consistent across the app.

---

## 1. Layout Rules

### 1.1 Single card, content-width

- **One card** wraps all rows (e.g. one bordered, elevated surface box).
- **Width:** Card is only as wide as its content. Use `w-fit` on the outer card container so it does not stretch to full column width.

### 1.2 Two-column grid for alignment

- Use a **CSS grid** with two columns: label column (auto width) and value column (remaining space).
- **Tailwind:** `grid grid-cols-[auto_1fr] gap-x-2 gap-y-1`.
- **Label column:** Left-aligned text (labels sit at the left edge of the card). Do **not** right-align labels.
- **Value column:** Values start at the same horizontal position so they align vertically.

### 1.3 Row structure

- Each logical row is two grid cells: one `<span>` for the label (including the colon), one `<span>` for the value.
- Labels use secondary text token: `text-[var(--token-text-secondary)]`.
- Values use primary text token: `text-[var(--token-text-primary)]`.
- Typography: `text-sm` for the whole block is the standard density.

**Example structure:**

```tsx
<div className="mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2">
  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)]">
    <span className="text-[var(--token-text-secondary)]">Label one:</span>
    <span>{valueOne}</span>
    <span className="text-[var(--token-text-secondary)]">Label two:</span>
    <span>{valueTwo}</span>
    {/* ... */}
  </div>
</div>
```

---

## 2. Card Container

- **Border / surface:** `rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]`.
- **Padding:** `px-3 py-2` for compact density.
- **Spacing below:** `mb-6` unless the layout requires otherwise.

---

## 3. Dates in Cards

- For **date values** in these cards, use the same format as tables: **`formatDateDisplay`** from `@/lib/date-utils` (dd-MM-YYYY), not the long format (e.g. "28 September 2025"). This matches event search and other table date columns.

---

## 4. Reference Implementation

**Components:** `src/components/organisms/event-analysis/EventStats.tsx` and
`src/components/organisms/event-analysis/WeatherCard.tsx`

Use EventStats or WeatherCard as the reference when implementing new compact
label–value cards. Copy the grid pattern, token usage, and card container
classes from there.

---

**End of Compact Label–Value Card Design Standard**
