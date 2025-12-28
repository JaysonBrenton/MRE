---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-28
updated: 2025-01-28 (Added text truncation in flex containers section to prevent horizontal compression issues)
description: Mobile UX guidelines ensuring all screens are touch-friendly and mobile-compliant
purpose: Ensures all MRE screens are fully mobile-compliant, touch-friendly, and aligned
         with enterprise UX standards. These guidelines are mandatory for all version 0.1.1 screens.
relatedFiles:
  - docs/design/mre-dark-theme-guidelines.md
  - docs/design/mre-ux-principles.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# MRE Mobile UX Guidelines

**Document Status:** Updated and aligned with MRE version 0.1.1 directives
**Authoritative Scope:** Applies to all UI in version 0.1.1
**Purpose:** Ensure all MRE screens are fully mobile-compliant, touch-friendly, and aligned with enterprise UX standards.

These guidelines are mandatory for all version 0.1.1 screens:

* Registration
* Login
* User Welcome
* Admin Console Welcome
* Dashboard
* Events List
* Event Search
* Event Analysis
* Driver Detail Pages
* Under Development Page

Future features (e.g., Analytics, Telemetry data ingestion, Setup Sheets) use this file for early planning but must NOT be implemented in version 0.1.1.

**Note:** Navigation features, table components, dashboard systems, and telemetry visualizations are fully in-scope for version 0.1.1 (see Sections 7, 11, and related documentation).

---

# 1. Mobile-First Foundation

All screens must be designed mobile-first.
Desktop behaviour is a progressive enhancement.

Key principles:

* Layouts must work flawlessly on a **narrow viewport first** (375–430px)
* UI must respect touch ergonomics
* No hover-only behaviours
* All important elements must be reachable with natural thumb movement

---

# 2. Viewport and Breakpoints

MRE uses a simple breakpoint strategy aligned with version 0.1.0 needs:

* **Mobile:** 0–599px
* **Tablet:** 600–899px
* **Desktop:** 900px+

All version 0.1.0 screens must function perfectly within **Mobile**.

Tablet and desktop adaptations are optional but recommended.

---

# 3. Touch Target Requirements

Every interactive element must meet the minimum touch size:

* **44px height** (Apple HIG)
* **48px height** recommended (Material Design)
* Minimum **8–12px spacing** between touch targets

Applies to:

* Buttons
* Form fields
* Toggles, checkboxes (if present in future phases)

Version 0.1.0 note: No checkboxes or toggles exist yet.

---

# 4. Layout and Spacing Rules

Spacing scale (must be consistent across all screens):

* 4px
* 8px
* 12px
* 16px
* 20px
* 24px

Rules:

* No inconsistent margins
* Forms must have clear vertical rhythm
* Avoid dense UI clusters
* Always allow comfortable breathing room above and below input groups

---

# 5. Flexbox Layout Requirements

**⚠️ CRITICAL WARNING: Horizontal Compression Bug**

A common and critical bug occurs when flex containers with text content don't have proper width constraints. This causes:
- Modals to compress horizontally, making content unreadable
- List items to collapse, pushing buttons/icons off-screen
- Layout breakage on mobile devices

**Prevention:**
1. **ALWAYS use reusable components** (`src/components/ui/Modal.tsx` and `src/components/ui/ListRow.tsx`)
2. If implementing manually, **ALWAYS** add `min-w-0` to flex containers AND use inline styles
3. **ALWAYS** test with long text content and on mobile viewport (375px)

See Section 5.7 for detailed requirements and reusable component usage.

---

All pages using flex layouts must follow these rules to prevent width collapse issues:

## 5.1 Root Container Requirements

When using `flex flex-col` on root page containers:
- Root container MUST have `w-full` class
- This ensures the container takes full viewport width

**Required pattern:**
```tsx
<div className="flex min-h-screen w-full flex-col">
  {/* page content */}
</div>
```

## 5.2 Page Container Requirements

Main content areas (`<main>` elements) in flex column layouts MUST include:
- `flex-1`: Takes available vertical space
- `w-full`: Forces full width
- `min-w-0`: Allows proper flex shrinking of children

**Required pattern:**
```tsx
<main className="page-container flex-1 w-full min-w-0 px-4 py-8">
  {/* content */}
</main>
```

**Why this matters:**
- Without `w-full`, flexbox may calculate width based on content, causing collapse
- Without `min-w-0`, flex children cannot shrink below their content size
- This combination prevents the common issue where containers collapse to 48px or less

## 5.3 Content Wrapper Requirements

Content wrappers with max-width constraints MUST include:
- `mx-auto`: Centers content horizontally
- `w-full`: Forces full width up to max-width
- `min-w-0`: Allows proper flex shrinking

**Required pattern:**
```tsx
<section className="content-wrapper mx-auto w-full min-w-0 max-w-2xl">
  {/* content */}
</section>
```

## 5.4 Form Input Requirements

All form inputs MUST include `min-w-0` in their className:
- Prevents inputs from forcing container width
- Ensures proper flexbox behavior in constrained layouts

**Required pattern:**
```tsx
<input className="block w-full min-w-0 rounded-md ..." />
```

## 5.5 Reusable Components

For consistency, use the provided layout components:

- **PageContainer**: `src/components/layout/PageContainer.tsx`
  - Handles main element with proper flex constraints
  - Automatically includes `flex-1 w-full min-w-0`

- **ContentWrapper**: `src/components/layout/ContentWrapper.tsx`
  - Handles content section with max-width constraints
  - Automatically includes `mx-auto w-full min-w-0`

**Example usage:**
```tsx
import PageContainer from "@/components/layout/PageContainer"
import ContentWrapper from "@/components/layout/ContentWrapper"

<PageContainer>
  <ContentWrapper maxWidth="2xl">
    {/* page content */}
  </ContentWrapper>
</PageContainer>
```

## 5.6 CSS Utilities

Global CSS utilities in `src/app/globals.css` automatically apply:
- `.page-container`: `min-width: 0; width: 100%;`
- `.content-wrapper`: `min-width: 0; width: 100%;`
- Form inputs: `min-width: 0;` (via type selectors)

These provide a safety net, but classes should still be explicitly added for clarity.

## 5.7 Text Truncation in Flex Containers

**⚠️ CRITICAL: This is a common source of layout bugs. Always use the provided reusable components.**

When displaying text content within flex containers, especially in lists, modals, or constrained layouts, text truncation MUST be properly implemented to prevent horizontal compression and layout breakage.

### ✅ Use Reusable Components (RECOMMENDED)

**For Modals:**
- **ALWAYS use** `src/components/ui/Modal.tsx` for all modal dialogs
- This component enforces proper width constraints automatically
- Prevents horizontal compression issues

**For List Rows:**
- **ALWAYS use** `src/components/ui/ListRow.tsx` for list items with text and actions
- Use `ListRowText` component for text content that should truncate
- Use `ListRowAction` component for buttons/icons that should not shrink

**Example using reusable components:**
```tsx
import Modal from "@/components/ui/Modal"
import ListRow, { ListRowText, ListRowAction } from "@/components/ui/ListRow"

<Modal isOpen={isOpen} onClose={handleClose} title="Select Track">
  {tracks.map((track) => (
    <ListRow 
      key={track.id} 
      onClick={() => handleSelect(track)}
      ariaLabel={`Select track ${track.trackName}`}
    >
      <ListRowText title={track.trackName}>{track.trackName}</ListRowText>
      <ListRowAction>
        <button onClick={(e) => { e.stopPropagation(); handleFavourite(track.id) }}>
          <StarIcon />
        </button>
      </ListRowAction>
    </ListRow>
  ))}
</Modal>
```

### Manual Implementation (Only if reusable components don't fit)

If you must implement manually, follow these requirements:

**Flex Container Requirements:**
- Flex container MUST include `min-w-0` to allow flex items to shrink below their content width
- Without `min-w-0`, flex items have an implicit `min-width: auto` which prevents proper shrinking
- Use inline styles: `style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}`

**Text Element Requirements:**
- Text elements that may overflow MUST include:
  - `min-w-0`: Allows the flex item to shrink
  - `truncate`: Applies `overflow-hidden text-ellipsis whitespace-nowrap` for proper truncation
  - Inline styles: `style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}`
- Text elements that should not shrink (e.g., icons, buttons) MUST include `flex-shrink-0`

**Required pattern (manual):**
```tsx
<div 
  className="flex items-center justify-between"
  style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
>
  <span 
    className="flex-1"
    style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    title={longTextContent}
  >
    {longTextContent}
  </span>
  <button className="flex-shrink-0 ml-4" style={{ flexShrink: 0 }}>Action</button>
</div>
```

**Why this matters:**
- Long text content in flex containers without `min-w-0` will force the container to expand horizontally
- This causes layout breakage in modals, cards, and constrained layouts
- Without proper truncation, text can push buttons/icons off-screen or cause horizontal scrolling
- The combination of `min-w-0` on both container and text element ensures proper flexbox shrinking behavior

**Common Use Cases:**
- List items with text and action buttons (e.g., track selection, event lists)
- Modal content with long text labels
- Card components with variable-length content
- Table cells with long text content
- Navigation items with long labels

**Anti-Pattern (DO NOT):**
```tsx
// ❌ Missing min-w-0 - will cause horizontal compression
<div className="flex items-center justify-between">
  <span className="flex-1">{longTextContent}</span>
  <button>Action</button>
</div>
```

**Correct Pattern (DO):**
```tsx
// ✅ Use reusable components (preferred)
<ListRow>
  <ListRowText>{longTextContent}</ListRowText>
  <ListRowAction><button>Action</button></ListRowAction>
</ListRow>

// OR manual implementation with proper constraints
<div 
  className="flex items-center justify-between"
  style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
>
  <span 
    className="flex-1"
    style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
  >
    {longTextContent}
  </span>
  <button className="flex-shrink-0" style={{ flexShrink: 0 }}>Action</button>
</div>
```

**Accessibility Note:**
- Truncated text should have a `title` attribute or tooltip showing the full text
- Ensure truncated content is accessible via screen readers (full text in aria-label if needed)
- Consider expandable text for critical content that must be fully readable

**Checklist Before Creating Modals or List Rows:**
- [ ] Have you checked if `src/components/ui/Modal.tsx` can be used?
- [ ] Have you checked if `src/components/ui/ListRow.tsx` can be used?
- [ ] If implementing manually, have you added `min-w-0` to all flex containers?
- [ ] Have you added inline styles for width constraints?
- [ ] Have you tested with long text content?
- [ ] Have you tested on mobile viewport (375px width)?

---

# 6. Forms on Mobile

All version 0.1.1 forms (registration and login) must follow these rules:

## 5.1 Single-Column Only

* Multi-column layouts are allowed in version 0.1.1 for complex forms, but single-column is preferred for mobile
* Inputs must stack vertically
* No side-by-side fields

## 5.2 Label Placement

* Use **top-aligned labels**, never placeholders-only
* Labels must use semantic text tokens

## 5.3 Input Field Rules

* Minimum height 44px
* Use dark theme tokens for fields and borders
* Use clear error states
* Validation messages must appear directly beneath the field

## 5.4 Keyboard-Friendly Behaviour

Mobile keyboards must not obstruct fields:

* Ensure bottom padding allows input visibility
* Avoid fixed-position buttons near the keyboard

---

# 7. Navigation on Mobile

Version 0.1.1 includes navigation features. **Breadcrumb navigation is the primary navigation pattern** for version 0.1.1.

**Breadcrumb Navigation (Primary Pattern):**
* Breadcrumb trails for deep navigation
* Shows current location in application hierarchy
* Clickable navigation path
* Mobile-friendly truncation for long paths
* Preferred navigation method for version 0.1.1
* Must be implemented on all pages with hierarchical navigation
* See `docs/design/navigation-patterns.md` for implementation guidelines

**Simplified Hamburger Menus:**
* Basic open/close toggle functionality
* Mobile-first implementation
* Complements sidebars on desktop (hamburger for mobile, sidebar for desktop)
* Minimal features (basic state management, simple accessibility)
* Minimum 44px touch target for menu toggle
* Touch-friendly with proper accessibility support
* See `docs/design/navigation-patterns.md` for simplified implementation guidelines

**Multi-Level Navigation (Secondary Pattern):**
* Hierarchical navigation structures (secondary to breadcrumbs)
* Collapsible menus for nested items
* Keyboard navigation support required
* Mobile-friendly expand/collapse behavior
* Use when breadcrumbs are insufficient for navigation needs

**Tab Navigation (Secondary Pattern):**
* Tab navigation for organizing related content within pages
* Mobile-responsive tab behavior
* Accessible tab panels with proper ARIA attributes
* Touch-friendly tab switching
* Use for organizing content within a single page context

**Integration with Sidebars:**
* Simplified hamburger menus complement sidebars (not replace)
* Desktop: Sidebar navigation preferred
* Mobile: Hamburger menu opens sidebar or navigation drawer
* Consistent navigation structure across devices

All navigation features must follow mobile-first principles and maintain accessibility standards. Breadcrumb navigation should be the primary method used throughout the application. See `docs/design/navigation-patterns.md` for complete specifications.

---

# 8. Typography on Mobile

Text must be legible:

* Minimum body text size: **14–16px**
* Minimum label size: **12–13px**
* Large headings should not exceed 28–32px
* Do not use overly thin font weights

Font tokens must come from the design system.

---

# 9. Buttons on Mobile

Buttons must:

* Be full-width or nearly full-width on mobile
* Use consistent height, padding, and typography
* Use the primary accent token for primary actions

Hover behaviour on desktop must not be required for usability.

Active and focus states must be visible.

---

# 10. Error Handling and Messaging

Error messages on mobile must:

* Be concise
* Use clear and predictable placement
* Avoid pop-ups or modal-only errors

Inline errors must:

* Use semantic error tokens (future feature)
* Maintain spacing rules

System-level errors must appear at the top of the form on mobile.

---

# 11. Table Components on Mobile

Version 0.1.1 includes table components with specific mobile behavior. Tables are fully in-scope and used in all specified locations: admin console, event lists page, driver management, and race results display.

**Usage Locations (All Required):**
* Admin console (users, events, tracks lists)
* Event lists page (browse imported events)
* Driver lists and management (driver information and transponder overrides)
* Race results display (race results with lap times and positions)

**Horizontal Scroll:**
* Tables may use horizontal scroll on mobile devices
* Preferred approach for data tables with many columns
* Touch-friendly scrolling with momentum
* Visual indicators for scrollable content

**Touch-Friendly Interactions:**
* Column sorting via tap on column headers (minimum 44px touch target)
* Row selection with adequate touch targets
* Filter controls accessible via touch
* Pagination controls with large touch targets (minimum 44px)

**Column Visibility:**
* Less important columns may be hidden on small screens
* Key data columns prioritized for mobile view
* Responsive column strategies per table type
* See `docs/design/table-component-specification.md` for complete guidelines

**Performance:**
* Virtual scrolling for large datasets
* Lazy loading of table rows
* Optimized rendering for mobile devices

All mobile behavior requirements apply to all table instances across the application. Tables are fully in-scope for version 0.1.1.

---

# 12. Responsive Behaviour

Responsive adjustments must not break layout.

For version 0.1.1:

* Multi-column layouts allowed with mobile-first degradation
* Complex flex arrangements supported with proper constraints
* Tables use horizontal scroll or responsive column strategies
* Dashboards adapt to screen size with widget reflow

Future features may have richer responsive layouts:

* Advanced data grids
* Complex card layouts
* Interactive graph components

These are now in scope for version 0.1.1.

---

# 13. Future Features (Not Allowed in Version 0.1.1)

Some mobile patterns remain out of scope for version 0.1.1:

* Setup-sheet editors
* Advanced telemetry overlays (beyond visualization)
* Complex multi-page workflows beyond defined scope
* Telemetry data ingestion (sensor data collection)

**Note:** The following are fully in scope for version 0.1.1:
* Data tables (see Section 11) - Used in admin console, event lists, driver management, race results
* Multi-column dashboards with customizable widgets (see `docs/architecture/dashboard-architecture.md`)
* Navigation features including breadcrumbs (primary), simplified hamburger menus, tabs, and multi-level dropdowns (see Section 7)
* Telemetry visualizations (see `docs/design/telemetry-visualization-specification.md`) - All visualization types are in-scope

---

# 13. Testing Requirements

Mobile UX tests must verify:

* Layout correctness at 375px width
* All touch targets meet size requirements
* No horizontal scrolling
* Labels are readable
* Error messages do not overflow
* Buttons are tappable without overlap
* The dark theme remains legible on mobile displays

Viewport screenshots are required for:

* Registration
* Login
* User welcome
* Admin console welcome
* Under development page

---

# 15. Integration with Other MRE Standards

All mobile UX decisions must be consistent with:

* **Dark theme guidelines:** `docs/design/mre-dark-theme-guidelines.md`
* **UX principles:** `docs/design/mre-ux-principles.md`
* **Architecture:** `docs/architecture/mobile-safe-architecture-guidelines.md`
* **Navigation patterns:** `docs/design/navigation-patterns.md`
* **Table component specification:** `docs/design/table-component-specification.md`
* **Dashboard architecture:** `docs/architecture/dashboard-architecture.md`
* **Telemetry visualization specification:** `docs/design/telemetry-visualization-specification.md`

If any conflict arises, the Architecture document takes precedence.

---

# 16. License

Internal use only. This document defines mandatory mobile UX rules for all version 0.1.1 screens.
