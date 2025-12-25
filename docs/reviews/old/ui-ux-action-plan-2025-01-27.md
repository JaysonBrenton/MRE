# UI/UX Review - Actionable Implementation Plan
## My Race Engineer (MRE) - January 27, 2025

**Plan Date:** January 27, 2025  
**Based On:** Comprehensive UI/UX Review Report  
**Priority:** P0 (Critical) → P1 (High) → P2 (Medium) → P3 (Low)

---

## Implementation Phases

### Phase 1: Critical Fixes (P0) - Week 1
**Goal:** Fix all critical issues blocking production readiness and WCAG compliance.

---

## P0.1: Migrate Legacy Tokens to Design System

### Files to Update:

#### 1. `src/app/dashboard/page.tsx`

**Current Issues:**
- Uses `--mre-text`, `--mre-surface`, `--mre-border-subtle`, `--mre-text-muted`, `--mre-accent`

**Changes Required:**

```tsx
// Replace all instances:
--mre-text → --token-text-primary
--mre-text-muted → --token-text-muted
--mre-surface → --token-surface
--mre-surface-alt → --token-surface-elevated
--mre-border-subtle → --token-border-muted
--mre-accent → --token-accent
```

**Specific Replacements:**
- Line 26: `text-[var(--mre-text)]` → `text-[var(--token-text-primary)]`
- Line 29: `text-[var(--mre-text-muted)]` → `text-[var(--token-text-muted)]`
- Line 36: `text-[var(--mre-text)]` → `text-[var(--token-text-primary)]`
- Line 41: `border-[var(--mre-border-subtle)]` → `border-[var(--token-border-muted)]`
- Line 41: `bg-[var(--mre-surface)]` → `bg-[var(--token-surface)]`
- Line 42: `text-[var(--mre-text)]` → `text-[var(--token-text-primary)]`
- Line 45: `text-[var(--mre-text-muted)]` → `text-[var(--token-text-muted)]`
- Line 50: `border-[var(--mre-border-subtle)]` → `border-[var(--token-border-muted)]`
- Line 50: `bg-[var(--mre-surface-alt)]` → `bg-[var(--token-surface-elevated)]`
- Line 50: `focus:ring-[var(--mre-accent)]` → `focus:ring-[var(--token-accent)]`
- Continue for all remaining instances...

---

#### 2. `src/app/components/AppShell.tsx`

**Changes Required:**
- Replace all `--mre-*` tokens with `--token-*` equivalents
- Same mapping as above

---

#### 3. `src/app/events/page.tsx`

**Changes Required:**
- Replace all `--mre-*` tokens with `--token-*` equivalents
- Same mapping as above

---

#### 4. `src/app/globals.css`

**After Migration:**
- Remove `--mre-*` token aliases (lines 62-69 and 115-122)
- Update `body` styles to use `--token-*` directly:
```css
body {
  background: var(--token-surface);
  color: var(--token-text-primary);
  font-family: Arial, Helvetica, sans-serif;
}
```

---

## P0.2: Replace Hardcoded Colors with Design Tokens

### 1. Update `src/app/globals.css`

**Add Status Tokens:**

```css
:root {
  /* ... existing tokens ... */
  
  /* Status colors */
  --token-status-success-bg: rgba(34, 197, 94, 0.2);
  --token-status-success-text: #4ade80;
  --token-status-info-bg: rgba(59, 130, 246, 0.2);
  --token-status-info-text: #60a5fa;
  --token-status-warning-bg: rgba(234, 179, 8, 0.2);
  --token-status-warning-text: #fbbf24;
  --token-status-error-bg: rgba(239, 68, 68, 0.2);
  --token-status-error-text: #f87171;
}

.light {
  /* ... existing light theme tokens ... */
  
  /* Status colors for light theme */
  --token-status-success-bg: rgba(34, 197, 94, 0.1);
  --token-status-success-text: #16a34a;
  --token-status-info-bg: rgba(59, 130, 246, 0.1);
  --token-status-info-text: #2563eb;
  --token-status-warning-bg: rgba(234, 179, 8, 0.1);
  --token-status-warning-text: #ca8a04;
  --token-status-error-bg: rgba(239, 68, 68, 0.1);
  --token-status-error-text: #dc2626;
}
```

---

### 2. Update `src/components/event-search/EventStatusBadge.tsx`

**Replace hardcoded colors:**

```tsx
const statusConfig: Record<EventStatus, { label: string; bgColor: string; textColor: string }> = {
  stored: {
    label: "Stored",
    bgColor: "bg-[var(--token-status-success-bg)]",
    textColor: "text-[var(--token-status-success-text)]",
  },
  imported: {
    label: "Imported",
    bgColor: "bg-[var(--token-status-success-bg)]",
    textColor: "text-[var(--token-status-success-text)]",
  },
  new: {
    label: "New (LiveRC only)",
    bgColor: "bg-[var(--token-status-info-bg)]",
    textColor: "text-[var(--token-status-info-text)]",
  },
  importing: {
    label: "Importing",
    bgColor: "bg-[var(--token-status-warning-bg)]",
    textColor: "text-[var(--token-status-warning-text)]",
  },
  failed: {
    label: "Failed import",
    bgColor: "bg-[var(--token-status-error-bg)]",
    textColor: "text-[var(--token-status-error-text)]",
  },
}
```

---

### 3. Update `src/components/event-search/ImportStatusToast.tsx`

**Replace hardcoded colors:**

```tsx
const statusColors = {
  started: "bg-[var(--token-status-info-bg)] text-[var(--token-status-info-text)] border-[var(--token-status-info-text)]",
  completed: "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)] border-[var(--token-status-success-text)]",
  failed: "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)] border-[var(--token-status-error-text)]",
}
```

---

## P0.3: Add Skip Links

### Update `src/app/layout.tsx`

**Add skip link after opening `<body>` tag:**

```tsx
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--token-accent)] focus:text-[var(--token-text-primary)] focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
  >
    Skip to main content
  </a>
  <ErrorBoundary>
    <Providers>{children}</Providers>
  </ErrorBoundary>
</body>
```

**Add `id="main-content"` to main elements in pages:**
- `src/app/welcome/page.tsx` - Add to `<main>` tag
- `src/app/admin/page.tsx` - Add to `<main>` tag
- `src/app/event-search/page.tsx` - Add to `<main>` tag
- `src/app/events/analyse/[eventId]/page.tsx` - Add to `<main>` tag

---

## P0.4: Fix Form Error Associations

### 1. Update `src/app/login/page.tsx`

**For Email Field (lines 198-216):**

```tsx
<div className="mobile-form-field">
  <label
    htmlFor="email"
    className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1"
  >
    Email address
  </label>
  <input
    id="email"
    name="email"
    type="email"
    autoComplete="email"
    required
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="block w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-3 text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
    placeholder="you@example.com"
    aria-invalid={!!error && error.includes("email")}
    aria-describedby={error && error.includes("email") ? "email-error" : undefined}
  />
  {error && error.includes("email") && (
    <p id="email-error" className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
      {error}
    </p>
  )}
</div>
```

**For Password Field (similar pattern):**

```tsx
<div className="mobile-form-field">
  <label
    htmlFor="password"
    className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1"
  >
    Password
  </label>
  <input
    id="password"
    name="password"
    type="password"
    autoComplete="current-password"
    required
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="block w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-3 text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
    placeholder="••••••••"
    aria-invalid={!!error && error.includes("password")}
    aria-describedby={error && error.includes("password") ? "password-error" : undefined}
  />
  {error && error.includes("password") && (
    <p id="password-error" className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
      {error}
    </p>
  )}
</div>
```

**Note:** The current implementation shows a single error message. Consider splitting errors by field or updating the error structure to support field-specific errors.

---

### 2. Update `src/app/register/page.tsx`

**Apply same pattern for all fields:**
- Email field
- Password field
- Driver Name field
- Team Name field

**Update error state structure:**

```tsx
const [errors, setErrors] = useState<{
  email?: string
  password?: string
  driverName?: string
  teamName?: string
}>({})
```

**Update error handling to set field-specific errors.**

---

### 3. Update `src/components/event-search/EventSearchForm.tsx`

**For Track Selector (lines 94-112):**

```tsx
<div>
  <label
    htmlFor="track-selector"
    className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
  >
    Track
  </label>
  <button
    type="button"
    id="track-selector"
    onClick={() => setIsModalOpen(true)}
    className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-left text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors hover:bg-[var(--token-surface)]"
    aria-invalid={!!errors?.track}
    aria-describedby={errors?.track ? "track-error" : undefined}
  >
    {selectedTrack ? selectedTrack.trackName : "Select a track"}
  </button>
  {errors?.track && (
    <p id="track-error" className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
      {errors.track}
    </p>
  )}
</div>
```

---

### 4. Update `src/components/event-search/DateRangePicker.tsx`

**For Start Date (lines 83-102):**

```tsx
<div>
  <label
    htmlFor="start-date"
    className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
  >
    Start Date
  </label>
  <input
    id="start-date"
    type="date"
    value={localStartDate}
    onChange={handleStartDateChange}
    max={today}
    disabled={disabled}
    className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    aria-invalid={!!errors?.startDate}
    aria-describedby={errors?.startDate ? "start-date-error" : undefined}
  />
  {errors?.startDate && (
    <p id="start-date-error" className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
      {errors.startDate}
    </p>
  )}
</div>
```

**Apply same pattern for End Date field.**

---

## P0.5: Add Chart Accessibility Labels

### 1. Update `src/components/event-analysis/BestLapBarChart.tsx`

**Add title and description to SVG (around line 169):**

```tsx
<svg width={width} height={height} aria-labelledby="best-lap-chart-title best-lap-chart-desc">
  <title id="best-lap-chart-title">Best Lap Times Comparison</title>
  <desc id="best-lap-chart-desc">
    Bar chart showing fastest lap time for each driver, sorted from fastest to slowest.
    {selectedDriverIds.length > 0 && `Showing ${selectedDriverIds.length} selected drivers.`}
    Click on bars to toggle driver selection.
  </desc>
  <Group left={margin.left} top={margin.top}>
    {/* ... existing chart content ... */}
  </Group>
</svg>
```

---

### 2. Update `src/components/event-analysis/GapEvolutionLineChart.tsx`

**Add similar title and description:**

```tsx
<svg width={width} height={height} aria-labelledby="gap-evolution-chart-title gap-evolution-chart-desc">
  <title id="gap-evolution-chart-title">Gap to Leader Evolution</title>
  <desc id="gap-evolution-chart-desc">
    Line chart showing how the time gap to the race leader changes over the course of the race for the top drivers.
    {selectedDriverIds.length > 0 && `Showing ${selectedDriverIds.length} selected drivers.`}
    Click on lines to toggle driver selection.
  </desc>
  {/* ... chart content ... */}
</svg>
```

---

### 3. Update `src/components/event-analysis/AvgVsFastestChart.tsx`

**Add similar title and description:**

```tsx
<svg width={width} height={height} aria-labelledby="avg-vs-fastest-chart-title avg-vs-fastest-chart-desc">
  <title id="avg-vs-fastest-chart-title">Average vs Fastest Lap Comparison</title>
  <desc id="avg-vs-fastest-chart-desc">
    Bar chart comparing each driver's average lap time to their fastest lap time.
    {selectedDriverIds.length > 0 && `Showing ${selectedDriverIds.length} selected drivers.`}
    Click on bars to toggle driver selection.
  </desc>
  {/* ... chart content ... */}
</svg>
```

---

## P0.6: Ensure Focus Indicators on All Interactive Elements

### 1. Update `src/components/event-analysis/DriverList.tsx`

**For sortable table headers (lines 145-174):**

```tsx
<th
  className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)] cursor-pointer hover:text-[var(--token-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
  onClick={() => handleSort("driverName")}
  role="columnheader"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleSort("driverName")
    }
  }}
>
  Driver Name <SortIcon field="driverName" />
</th>
```

**Apply same pattern to all sortable headers.**

---

### 2. Audit All Interactive Elements

**Check and ensure focus indicators on:**
- All buttons (already have `focus:ring-2`)
- All links
- All form inputs (already have focus styles)
- All interactive chart elements
- Modal close buttons
- Dropdown toggles

---

## P0.7: Fix Toast Notification Accessibility

### Update `src/components/event-search/ImportStatusToast.tsx`

**Improve accessibility:**

```tsx
export default function ImportStatusToast({
  status,
  message,
  eventName,
  onClose,
  autoDismiss = true,
  autoDismissDelay = 5000,
}: ImportStatusToastProps) {
  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(() => {
        onClose()
      }, autoDismissDelay)

      return () => clearTimeout(timer)
    }
  }, [autoDismiss, autoDismissDelay, onClose])

  const statusColors = {
    started: "bg-[var(--token-status-info-bg)] text-[var(--token-status-info-text)] border-[var(--token-status-info-text)]",
    completed: "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)] border-[var(--token-status-success-text)]",
    failed: "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)] border-[var(--token-status-error-text)]",
  }

  // Use assertive for errors, polite for others
  const ariaLive = status === "failed" ? "assertive" : "polite"

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-md border ${statusColors[status]} shadow-lg`}
      role="alert"
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium">{message}</p>
          {eventName && <p className="text-sm mt-1 opacity-90">{eventName}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close notification"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
```

---

## P0.8: Add Loading State Announcements

### 1. Update `src/components/event-search/EventSearchContainer.tsx`

**Add loading announcement (around line 682):**

```tsx
if (isLoadingTracks) {
  return (
    <div className="text-center py-8">
      <div aria-live="polite" aria-busy="true" className="sr-only">
        Loading tracks...
      </div>
      <p className="text-[var(--token-text-secondary)]">Loading tracks...</p>
    </div>
  )
}
```

---

### 2. Update `src/components/event-search/EventTable.tsx`

**Add loading announcement (around line 75):**

```tsx
if (isLoading) {
  return (
    <div className="mt-8 text-center py-8">
      <div aria-live="polite" aria-busy="true" className="sr-only">
        Searching for events...
      </div>
      <p className="text-[var(--token-text-secondary)]">Searching for events...</p>
    </div>
  )
}
```

---

## Phase 2: High Priority Fixes (P1) - Weeks 2-3

### P1.1: Standardize Button Heights

**Action:** Ensure all buttons use `mobile-button` class which enforces 44px minimum, or explicitly use `h-11` (44px).

**Files to audit:**
- All button components
- Ensure consistent height application

---

### P1.2: Add Modal Backdrop Click Handler

**Update `src/components/event-search/TrackSelectionModal.tsx`:**

```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-0"
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }}
>
  {/* ... modal content ... */}
</div>
```

---

### P1.3: Improve Empty States

**Update `src/components/event-search/EventTable.tsx`:**

```tsx
if (events.length === 0) {
  return (
    <div className="mt-8 text-center py-8">
      <p className="text-[var(--token-text-secondary)] mb-2">
        No events found for this track and date range.
      </p>
      <p className="text-sm text-[var(--token-text-muted)]">
        Try adjusting your date range or selecting a different track.
      </p>
    </div>
  )
}
```

---

### P1.4: Fix Table Header Accessibility

**Update `src/components/event-analysis/DriverList.tsx`:**

Convert table headers to proper button elements with `aria-sort`:

```tsx
<th className="text-left py-3 px-4">
  <button
    onClick={() => handleSort("driverName")}
    className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
    aria-sort={sortField === "driverName" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
  >
    Driver Name <SortIcon field="driverName" />
  </button>
</th>
```

---

### P1.5: Add Navigation Active States

**Update `src/components/AuthenticatedNav.tsx`:**

```tsx
import { usePathname } from "next/navigation"

export default function AuthenticatedNav() {
  const pathname = usePathname()
  
  return (
    <nav className="w-full border-b border-[var(--token-border-default)] bg-[var(--token-surface)]">
      {/* ... */}
      <Link
        href="/welcome"
        className={`mobile-list-item flex items-center px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-3 sm:py-2 ${
          pathname === "/welcome"
            ? "text-[var(--token-accent)] border-b-2 border-[var(--token-accent)]"
            : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
        }`}
      >
        Welcome
      </Link>
      {/* Similar for Event Search link */}
    </nav>
  )
}
```

---

## Phase 3: Medium Priority Improvements (P2) - Month 2

### P2.1: Add Loading Skeletons

**Create `src/components/LoadingSkeleton.tsx`:**

```tsx
export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-[var(--token-surface-elevated)] rounded w-3/4"></div>
      <div className="h-4 bg-[var(--token-surface-elevated)] rounded"></div>
      <div className="h-4 bg-[var(--token-surface-elevated)] rounded w-5/6"></div>
    </div>
  )
}
```

**Use in EventTable and other loading states.**

---

### P2.2: Implement Focus Trap in Modals

**Add focus trap library or implement custom:**

```tsx
// Use focus-trap-react or implement custom focus trap
import FocusTrap from 'focus-trap-react'

<FocusTrap>
  <div className="modal-content">
    {/* modal content */}
  </div>
</FocusTrap>
```

---

### P2.3: Add Breadcrumb Navigation

**Create `src/components/Breadcrumbs.tsx`:**

```tsx
export default function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm text-[var(--token-text-secondary)]">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-[var(--token-text-primary)]">
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--token-text-primary)]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

**Use in event analysis page.**

---

## Testing Checklist

After implementing fixes, test:

### Accessibility
- [ ] Skip links work and are visible on focus
- [ ] All form errors are announced by screen readers
- [ ] Charts have accessible labels
- [ ] All interactive elements have visible focus indicators
- [ ] Toast notifications are announced
- [ ] Loading states are announced

### Design System
- [ ] All `--mre-*` tokens migrated
- [ ] No hardcoded colors remain
- [ ] Status colors use tokens
- [ ] Consistent spacing throughout

### Mobile
- [ ] All buttons meet 44px minimum
- [ ] Modals work correctly on mobile
- [ ] Empty states are helpful
- [ ] Date inputs work on mobile

### UX
- [ ] Navigation active states visible
- [ ] Error messages are actionable
- [ ] Loading states provide feedback
- [ ] Empty states guide users

---

## Implementation Order

1. **Day 1-2:** Token migration (P0.1)
2. **Day 3:** Hardcoded colors (P0.2)
3. **Day 4:** Skip links (P0.3)
4. **Day 5:** Form error associations (P0.4)
5. **Day 6:** Chart accessibility (P0.5)
6. **Day 7:** Focus indicators and toast accessibility (P0.6, P0.7, P0.8)
7. **Week 2:** P1 items
8. **Week 3:** P1 items continued
9. **Month 2:** P2 items

---

**End of Action Plan**

