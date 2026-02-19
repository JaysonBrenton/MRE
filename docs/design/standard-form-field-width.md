---
created: 2026-02-16
creator: Jayson Brenton
lastModified: 2026-02-16
description: Design standard for lookup, filter, and form control field widths
purpose:
  Ensures consistent width for form controls (inputs, buttons, lookup fields)
  that appear alongside tables or in modals. Matches the Event Search form
  pattern for visual alignment.
relatedFiles:
  - src/components/organisms/event-search/EventSearchForm.tsx
  - src/components/organisms/event-analysis/CombinedDriversTable.tsx
  - docs/architecture/atomic-design-system.md
---

# Standard Form Field Width Design Standard

**Status:** Authoritative  
**Scope:** Lookup fields, filter inputs, and similar form controls (search/filter by name, etc.)  
**Applies to:** All contributors (human and LLM)

Use this standard whenever you add a **lookup or filter field** (e.g. "Find driver", "Search drivers") that appears above a table or alongside other form controls. The width matches the Event Search modal's Execute button and other form fields for visual consistency.

---

## 1. Width and Layout

### 1.1 Standard field width

- **Width:** `w-[9rem] min-w-[9rem]` (144px at 16px base font).
- **Container:** Wrap the input/control in a `div` with these classes. The control inside (e.g. `DriverNameFilter`, `input`, or `Button`) should use `w-full` so it fills the container.

### 1.2 Label structure

- **Label:** Use `block text-sm font-medium text-[var(--token-text-primary)] mb-2` so the label sits above the control with consistent spacing.
- **Association:** Use `htmlFor` on the label and `id` on the input for accessibility.
- **Group:** Add `role="group"` and `aria-labelledby` on the container when appropriate.

**Example structure:**

```tsx
<div className="w-[9rem] min-w-[9rem]" role="group" aria-labelledby="my-field-label">
  <label
    id="my-field-label"
    htmlFor="my-field-input"
    className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
  >
    Find a Driver
  </label>
  <DriverNameFilter
    id="my-field-input"
    driverNames={names}
    value={value}
    onChange={onChange}
    placeholder="Type to search by name..."
  />
</div>
```

---

## 2. Reference Implementation

- **Event Search form:** `EventSearchForm.tsx` – Track selector, Date range, Execute button all use `h-11 w-[9rem] min-w-[9rem]`.
- **Drivers table:** `CombinedDriversTable.tsx` – "Find driver" lookup uses the same width.

---

## 3. Buttons vs. Inputs

- **Buttons:** Add `h-11` for consistent height: `className="h-11 w-[9rem] min-w-[9rem] ..."`.
- **Text inputs / lookup fields:** The container uses `w-[9rem] min-w-[9rem]`; the input typically has its own height (e.g. from `py-2`). No need to add `h-11` to inputs unless you explicitly want to match button height.

---

**End of Standard Form Field Width Design Standard**
