---
created: 2026-03-10
creator: Dashboard UI/UX Audit Remediation
lastModified: 2026-03-10
description: Form patterns for lookup fields, dropdowns, and text inputs
purpose:
  Documents dropdown/combobox and text input patterns for dashboard and
  event-analysis. Complements the standard form field width and design system.
relatedFiles:
  - docs/design/standard-form-field-width.md
  - src/components/atoms/StandardInput.tsx
  - src/components/organisms/event-analysis/ChartControls.tsx
  - src/components/organisms/dashboard/EventActionsProvider.tsx
---

# Form Patterns

**Status:** Authoritative for dashboard and event-analysis scope  
**Scope:** Lookup fields, filter dropdowns, and text inputs in modals and
toolbars

---

## 1. Text inputs

- Use **`StandardInput`** (`@/components/atoms/StandardInput`) for all
  single-line text inputs so styling and focus states stay consistent.
- For lookup/filter fields (e.g. "Search drivers"), apply the container width
  from [standard-form-field-width.md](./standard-form-field-width.md):
  **`w-[9rem] min-w-[9rem]`**.
- Optional `label` and `error` props are supported; use an external label with
  `role="group"` and `aria-labelledby` when the label is outside the component
  (e.g. in a toolbar row).

---

## 2. Dropdown / combobox (filter by class, etc.)

- **Width:** Use **`w-[9rem] min-w-[9rem]** for the dropdown trigger container,
  per [standard-form-field-width.md](./standard-form-field-width.md).
- **Trigger:** A `<button>` with `aria-expanded`, `aria-label` (e.g. "Filter by
  class"), and clear visual state for open/closed (e.g. chevron rotation).
- **Panel:** Absolutely positioned list (`position: absolute`, `z-10`), same
  width as trigger or `w-full`, with scroll when needed
  (`max-h-60 overflow-auto`).
- **Options:** Use `<button type="button">` per option; `focus:ring-2` and
  `hover:bg-[var(--token-surface-raised)]` for focus and hover.
- **Click outside:** Close the dropdown when the user clicks outside (use a
  `mousedown` listener and a ref on the dropdown container).
- **Styling:** Border `border-[var(--token-border-default)]`, background
  `bg-[var(--token-surface-elevated)]`, text `text-[var(--token-text-primary)]`,
  focus ring `focus:ring-[var(--token-interactive-focus-ring)]`.

Reference implementations: **ChartControls** (class filter + driver search) and
**EventActionsProvider** (driver modal class filter + search).

---

## 3. Reference implementations

| Pattern       | Component                           | Notes                                                    |
| ------------- | ----------------------------------- | -------------------------------------------------------- |
| Driver search | ChartControls, EventActionsProvider | `StandardInput` in `w-[9rem] min-w-[9rem]`               |
| Class filter  | ChartControls, EventActionsProvider | Button trigger + absolute panel, `w-[9rem] min-w-[9rem]` |

---

**End of Form Patterns**
