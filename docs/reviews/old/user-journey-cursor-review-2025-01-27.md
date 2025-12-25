---
created: 2025-01-27
creator: Cursor (AI Assistant)
lastModified: 2025-01-27
reviewVersion: 1.0
description: Comprehensive user experience review of the complete user journey from login to viewing event data
purpose: Identify workflow issues, navigation problems, and UX improvements to make the user experience as slick as possible
relatedFiles:
  - src/app/login/page.tsx
  - src/app/register/page.tsx
  - src/app/welcome/page.tsx
  - src/app/admin/page.tsx
  - src/app/dashboard/page.tsx
  - src/app/event-search/page.tsx
  - src/app/events/page.tsx
  - src/app/events/analyse/[eventId]/page.tsx
  - src/components/AuthenticatedNav.tsx
  - src/components/event-search/EventRow.tsx
  - src/components/dashboard/DashboardClient.tsx
---

# User Journey Review: Login to Event Data Viewing
## My Race Engineer (MRE) - January 27, 2025

**Review Date:** January 27, 2025  
**Reviewer:** Cursor (AI Assistant)  
**Scope:** Complete user journey from authentication through event discovery, import, and analysis  
**Focus:** Workflow logic, navigation patterns, user experience flow, and opportunities for improvement

---

## Executive Summary

This review traces the complete user journey from initial login through viewing detailed event analysis data. The analysis identifies **critical workflow issues**, **navigation inconsistencies**, and **user experience gaps** that prevent a smooth, intuitive experience.

**Overall Assessment:** The application has a solid architectural foundation, but the **user journey is fragmented** with multiple navigation paths, unclear entry points, and inconsistent patterns for moving between features. Users face **cognitive overhead** trying to understand how to accomplish their primary goal: finding and analyzing race event data.

**Key Findings:**
- **Critical Issues:** 10 workflow/navigation problems that significantly impact UX
- **High Priority Issues:** 10 UX improvements that would dramatically enhance flow
- **Medium Priority Enhancements:** 13 polish items for smoother experience
- **Low Priority Suggestions:** 6 future considerations

**Primary User Journey Problems:**
1. Welcome page is a dead-end with no guidance
2. Multiple competing entry points (Dashboard vs Event Search vs Events page)
3. Fragile sessionStorage-based event selection pattern
4. Unclear relationship between Event Search and Events page
5. Missing breadcrumb navigation for deep pages
6. No clear "next step" guidance at any point in the journey

---

## 1. Complete User Journey Mapping

### 1.1 Journey: New User Registration → First Event Analysis

**Step 1: Landing Page (`/`)**
- **Current State:** Simple landing with "Sign in" and "Create account" buttons
- **User Action:** Click "Create account"
- **Status:** ✅ Clear and simple

**Step 2: Registration (`/register`)**
- **Current State:** Form with email, password, driver name, team name (optional)
- **User Action:** Fill form and submit
- **Post-Submit:** Auto-login → redirects to `/welcome`
- **Status:** ✅ Functional, but auto-login could fail silently

**Step 3: Welcome Page (`/welcome`)**
- **Current State:** Just displays "Welcome back {Driver Name}" with navigation
- **User Action:** User must figure out what to do next
- **Navigation Available:** Dashboard, Event Search, Logout
- **Status:** ❌ **CRITICAL ISSUE** - Dead-end page with no guidance

**Step 4: Dashboard (`/dashboard`)**
- **Current State:** Shows "Get Started" cards:
  - "Import an event from LiveRC" → links to `/events` (not `/event-search`)
  - "Upload a telemetry file" → disabled
  - "Create a setup notebook" → disabled
- **User Action:** User clicks "View events" expecting to import, but lands on Events list
- **Status:** ❌ **CRITICAL ISSUE** - Misleading navigation

**Step 5: Events Page (`/events`)**
- **Current State:** Shows list of already-imported events (empty for new user)
- **User Action:** User sees empty state, must navigate elsewhere
- **Status:** ❌ **CRITICAL ISSUE** - Not the right entry point for new users

**Step 6: Event Search (`/event-search`)**
- **Current State:** Track selection + date range → search → import → select
- **User Action:** 
  1. Select track
  2. (Optional) Set date range
  3. Click "Search"
  4. Wait for results (DB + LiveRC check)
  5. Click "Import" on desired event
  6. Wait for import
  7. Click "Select" button
- **Post-Select:** Stores event ID in sessionStorage → redirects to `/dashboard`
- **Status:** ⚠️ **WORKFLOW ISSUE** - Indirect path to analysis

**Step 7: Dashboard (with selected event)**
- **Current State:** Shows EventOverview component with event summary
- **User Action:** Click chart icon to view full analysis
- **Status:** ⚠️ Requires extra click, sessionStorage dependency is fragile

**Step 8: Event Analysis (`/events/analyse/[eventId]`)**
- **Current State:** Full event analysis with tabs (Overview, Drivers)
- **User Action:** Explore data
- **Status:** ✅ Good once reached, but journey to get here is convoluted

---

### 1.2 Journey: Returning User Login → Event Analysis

**Step 1: Login (`/login`)**
- **Current State:** Email/password form
- **Post-Submit:** Complex redirect logic:
  1. Calls `authenticate()` server action
  2. Manually fetches `/api/auth/session`
  3. Checks `isAdmin` flag
  4. Redirects to `/admin` or `/welcome`
- **Status:** ⚠️ **COMPLEXITY ISSUE** - Multiple redirects, session checks, error handling

**Step 2: Welcome Page (`/welcome`)**
- **Same issues as new user journey**

**Step 3-8:** Same as new user journey

---

### 1.3 Journey: Direct Event Analysis (Returning User)

**Alternative Path:** User navigates to `/events` → clicks event card → `/events/analyse/[eventId]`
- **Status:** ✅ **BETTER PATH** - Direct and clear, but not discoverable from welcome/dashboard

---

## 2. Critical Workflow Issues (P0)

### 2.1 Welcome Page is a Dead-End

**Issue:** The welcome page (`/welcome`) shows only a greeting with no guidance on what to do next. Users must figure out the navigation themselves.

**Current Code:**
```12:46:src/app/welcome/page.tsx
export default async function WelcomePage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Redirect admins to admin page
  if (session.user.isAdmin) {
    redirect("/admin")
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--token-surface)]">
      <AuthenticatedNav />
      <main id="main-content" className="page-container flex-1 flex flex-col px-4 py-8" tabIndex={-1}>
        <section className="content-wrapper flex-1 flex items-center justify-center w-full max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
            Welcome back {session.user.name}
          </h1>
        </section>
        <Footer />
      </main>
    </div>
  )
}
```

**Impact:** 
- New users don't know what to do next
- No clear call-to-action
- Wastes user's time and creates confusion

**Recommendation:**
- **Option A (Preferred):** Redirect welcome page directly to dashboard
- **Option B:** Add prominent "Get Started" section with:
  - "Search for events" button → `/event-search`
  - "View imported events" button → `/events`
  - Quick stats if user has imported events
- **Option C:** Make welcome page show recent activity or suggested next steps

**Priority:** P0 - First impression blocker

---

### 2.2 Dashboard "Get Started" Card Misleads Users

**Issue:** The dashboard card says "Import an event from LiveRC" but links to `/events` (list of imported events), not `/event-search` (where import happens).

**Current Code:**
```49:63:src/app/dashboard/page.tsx
            {/* Import Event Card */}
            <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6">
              <h3 className="mb-2 text-xl font-semibold text-[var(--token-text-primary)]">
                Import an event from LiveRC
              </h3>
              <p className="mb-4 text-sm text-[var(--token-text-muted)]">
                Discover and import race events from LiveRC to analyze lap times, driver performance, and race data.
              </p>
              <Link
                href="/events"
                className="mobile-button inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
              >
                View events
              </Link>
            </div>
```

**Impact:**
- Users click expecting to import, but see empty list (if new) or list of already-imported events
- Creates confusion about where import functionality lives
- Breaks user's mental model

**Recommendation:**
- Change link from `/events` to `/event-search`
- Update button text to "Search for events" or "Import event"
- Alternatively, change card title to "View imported events" if keeping `/events` link

**Priority:** P0 - Misleading navigation

---

### 2.3 Fragile sessionStorage-Based Event Selection

**Issue:** Event Search uses sessionStorage to pass selected event ID to dashboard, which is fragile and creates an indirect path to event analysis.

**Current Code:**
```74:79:src/components/event-search/EventRow.tsx
  const handleSelect = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mre-selected-event-id", event.id)
      router.push("/dashboard")
    }
  }
```

**Impact:**
- SessionStorage can be cleared, causing lost state
- Indirect path: Search → Select → Dashboard → Click icon → Analysis
- Not shareable (can't bookmark or share link to selected event)
- Breaks browser back button expectations
- Dashboard must check sessionStorage on every load

**Recommendation:**
- **Option A (Preferred):** "Select" button should go directly to `/events/analyse/[eventId]`
- **Option B:** If dashboard selection is desired, use URL parameter: `/dashboard?eventId=[id]`
- **Option C:** Remove "Select" button entirely, make entire row clickable to go to analysis

**Priority:** P0 - Fragile pattern, poor UX

---

### 2.4 Multiple Competing Entry Points

**Issue:** There are three different pages that seem to do similar things:
- `/dashboard` - Overview with "Get Started" cards
- `/event-search` - Search and import events
- `/events` - List of imported events

**Impact:**
- Users don't know which page to use
- Navigation is unclear
- Creates cognitive overhead

**Recommendation:**
- **Clarify purpose of each page:**
  - **Dashboard:** Overview, recent activity, quick stats, "Get Started" for new users
  - **Event Search:** Primary entry point for discovering and importing NEW events
  - **Events:** Browse and access ALREADY IMPORTED events
- **Add clear navigation labels** that explain purpose
- **Consider consolidating** if pages overlap too much

**Priority:** P0 - Navigation clarity

---

### 2.5 Login Redirect Logic is Overly Complex

**Issue:** Login page has complex redirect logic with multiple try-catch blocks, session fetching, and manual redirects.

**Current Code:**
```88:148:src/app/login/page.tsx
        if (result) {
          // result is a string error message from the server action
          // This is an expected validation error, not a system error
          logger.warn("Authentication failed", { reason: result })
          setError(result)
          setLoading(false)
          return
        }

      // Success - NextAuth's signIn will handle redirect via middleware
      // But we'll also manually redirect to ensure it happens
      router.refresh()
      
      // Check session and redirect to appropriate page
      // Add error handling for session endpoint
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        
        if (!response.ok) {
          // If session endpoint fails, just redirect to welcome page
          logger.warn("Session endpoint returned error, redirecting to welcome", {
            status: response.status,
            statusText: response.statusText
          })
          router.push("/welcome")
          return
        }
        
        let session
        try {
          session = await response.json()
        } catch (jsonError) {
          logger.error("Failed to parse session response", {
            error: jsonError instanceof Error
              ? {
                  name: jsonError.name,
                  message: jsonError.message,
                }
              : String(jsonError),
          })
          router.push("/welcome")
          return
        }

        if (session?.user?.isAdmin) {
          router.push("/admin")
        } else {
          router.push("/welcome")
        }
      } catch (sessionError) {
        // If session check fails, just redirect to welcome page
        logger.warn("Failed to check session, redirecting to welcome", {
          error: sessionError instanceof Error
            ? {
                name: sessionError.name,
                message: sessionError.message,
              }
            : String(sessionError),
        })
        router.push("/welcome")
      }
```

**Impact:**
- Complex error handling that's hard to maintain
- Multiple redirect paths that could fail
- Relies on client-side session fetch which could be slow
- Middleware should handle redirects, not client code

**Recommendation:**
- Let NextAuth middleware handle redirects automatically
- Use `redirectTo` parameter in signIn call
- Simplify to: authenticate → refresh → let middleware redirect
- Or use server action return value to indicate success, then redirect

**Priority:** P0 - Code complexity, potential bugs

---

### 2.6 Missing Breadcrumb Navigation

**Issue:** Deep pages like `/events/analyse/[eventId]` have no breadcrumb navigation, making it hard to understand where you are or go back.

**Impact:**
- Users don't know how they got to the page
- Hard to navigate back to parent pages
- No sense of hierarchy

**Recommendation:**
- Add breadcrumb component:
  - `Dashboard > Events > [Event Name]`
  - Or: `Event Search > [Event Name]`
- Make breadcrumb items clickable
- Show on all pages deeper than 2 levels

**Priority:** P0 - Navigation clarity

---

### 2.7 Missing Manual "Check LiveRC" Button

**Issue:** The workflow specification requires a visible "Check LiveRC" button so users can manually query LiveRC even when database results exist. However, while a `CheckLiveRCButton` component exists (`src/components/event-search/CheckLiveRCButton.tsx`), it is never rendered in the Event Search interface.

**Current State:**
- `CheckLiveRCButton` component exists and is properly implemented
- `checkLiveRC()` function exists in `EventSearchContainer`
- Component is never imported or rendered in `EventSearchForm` or `EventSearchContainer`
- Users can only trigger LiveRC check by re-running the entire search

**Impact:**
- Users cannot manually refresh LiveRC discovery without losing their current search results
- Violates workflow specification requirement (docs/frontend/liverc/user-workflow.md lines 310-317)
- Forces users to re-enter search criteria to check for new events
- Poor UX when users want to check for updates after initial search

**Recommendation:**
- Render `CheckLiveRCButton` above the event table in `EventSearchContainer`
- Show button when search has been executed (even if results exist)
- Display "Checking LiveRC..." state while discovery is in progress
- Allow manual trigger without clearing current results

**Priority:** P0 - Workflow specification violation, missing functionality

---

### 2.8 Missing ImportPrompt/Import-All Flow

**Issue:** The workflow specification requires a bulk "Import All" prompt when new events are discovered from LiveRC. An `ImportPrompt` component exists (`src/components/event-search/ImportPrompt.tsx`) but is never mounted. Instead, users must import events one-by-one via individual "Import" buttons on each event row.

**Current State:**
- `ImportPrompt` component exists and implements the required modal dialog
- Component shows "We found X new events... Import all now?" message
- Component is never imported or rendered in `EventSearchContainer`
- Users must click "Import" on each event individually

**Impact:**
- Violates Alpha workflow specification (docs/frontend/liverc/user-workflow.md lines 325-332)
- Makes bulk imports painful - users must click import button for each event
- No way to import all discovered events with a single action
- Contradicts documented workflow that mandates bulk import only

**Recommendation:**
- Mount `ImportPrompt` in `EventSearchContainer` when `newEventsFromLiveRC` has items
- Track `newEventsFromLiveRC` state properly
- Show prompt modal: "We found X new events on LiveRC. Import all now?"
- Implement "Import All" action that queues all discovered events
- Remove individual "Import" buttons for LiveRC-only events (keep for re-importing existing events)

**Priority:** P0 - Workflow specification violation, poor bulk import UX

---

### 2.9 Incomplete Event Status Model

**Issue:** Event status badges support `stored|imported|new|importing|failed` states, but the implementation only ever renders `imported` or `new`. The `importing` and `failed` states are never shown, and there's no transition to `importing` when an import job starts.

**Current Code:**
```38:63:src/components/event-search/EventRow.tsx
function getStatusFromIngestDepth(ingestDepth: string | null | undefined, eventId?: string): EventStatus {
  // Check if this is a LiveRC-only event (ID starts with "liverc-")
  if (eventId?.startsWith("liverc-")) {
    return "new"
  }

  // Normalize ingestDepth: trim whitespace and convert to lowercase
  const normalizedDepth = ingestDepth?.trim().toLowerCase() || ""

  switch (normalizedDepth) {
    case "laps_full":
    case "lapsfull": // Handle potential variations
      return "imported"
    case "none":
    case "": // Empty or null means not imported
      return "new"
    default:
      // For any other value, check if it contains "full" or "laps" as a hint
      // This handles edge cases where API might return variations
      if (normalizedDepth.includes("full") || normalizedDepth.includes("laps")) {
        return "imported"
      }
      // Default to new for unknown values
      return "new"
  }
}
```

**Impact:**
- Users don't see when an import is in progress
- Users don't see when an import has failed
- No visual feedback during import process
- Violates workflow specification requirement for status transitions (docs/frontend/liverc/user-workflow.md lines 353-360)
- Toast notifications don't announce "Import started" as required

**Recommendation:**
- Maintain per-event import status in component state (`importingEventIds`, `failedEventIds`)
- Set status to `importing` when import button is clicked
- Set status to `failed` if import API call fails
- Update `EventStatusBadge` to display `importing` and `failed` states
- Show toast notification: "Import started for [event name]" when import begins
- Update status to `imported` on successful completion

**Priority:** P0 - Missing status feedback, workflow specification violation

---

### 2.10 Event Analysis Tabs Missing but Referenced

**Issue:** `EventAnalysisClient` deliberately filters the tab list to only show Overview and Drivers, hiding Sessions/Heats and Comparisons tabs. However, the Drivers tab copy references the Comparisons tab, which is unreachable.

**Current Code:**
```59:86:src/app/events/analyse/[eventId]/EventAnalysisClient.tsx
  // Only show Overview and Drivers tabs for now (Sessions and Comparisons deferred)
  const availableTabs = [
    { id: "overview" as TabId, label: "Overview" },
    { id: "drivers" as TabId, label: "Drivers" },
  ]
```

**Referenced in Drivers Tab:**
```40:42:src/components/event-analysis/DriversTab.tsx
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          Select drivers to compare in the Comparisons tab
        </p>
```

**Impact:**
- Users see confusing reference to a tab that doesn't exist
- Workflow specification requires Sessions/Comparisons as first-class tabs (docs/frontend/liverc/user-workflow.md lines 615-633)
- Experience feels unfinished at the "hero moment" (viewing event analysis)
- Users can't access functionality that the UI suggests exists

**Recommendation:**
- **Option A (Preferred):** Render all four tabs immediately, even if Sessions/Comparisons are placeholder panels with roadmap notes
- **Option B:** Remove references to Comparisons tab from Drivers tab copy until it's implemented
- **Option C:** Show tabs but disable them with tooltip explaining "Coming soon"
- Ensure navigation surface matches documented expectations

**Priority:** P0 - Inconsistent UI, missing documented functionality

---

## 3. High Priority UX Issues (P1)

### 3.1 No Active State in Navigation

**Issue:** Navigation items don't show which page is currently active.

**Current Code:**
```41:53:src/components/AuthenticatedNav.tsx
          <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-1">
            <Link
              href="/dashboard"
              className="mobile-list-item flex items-center px-4 py-3 text-sm font-medium text-[var(--token-text-secondary)] transition-colors hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-3 sm:py-2"
            >
              Dashboard
            </Link>
            <Link
              href="/event-search"
              className="mobile-list-item flex items-center px-4 py-3 text-sm font-medium text-[var(--token-text-secondary)] transition-colors hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-3 sm:py-2"
            >
              Event Search
            </Link>
```

**Recommendation:**
- Use `usePathname()` to detect current route
- Add active state styling (underline, background, or accent color)
- Update className conditionally based on active state

**Priority:** P1 - Navigation clarity

---

### 3.2 Event Search "Select" Button Should Go Directly to Analysis

**Issue:** "Select" button goes to dashboard instead of directly to event analysis.

**Recommendation:**
- Change `handleSelect` to navigate directly to `/events/analyse/[eventId]`
- Remove sessionStorage dependency
- Makes the flow: Search → Import → View Analysis (3 steps instead of 5)

**Priority:** P1 - Streamline workflow

---

### 3.3 Empty States Don't Guide Users

**Issue:** Empty states (no events found, no imported events) don't tell users what to do next.

**Current Code:**
```88:95:src/components/event-search/EventTable.tsx
  if (events.length === 0) {
    return (
      <div className="mt-8 text-center py-8">
        <p className="text-[var(--token-text-secondary)]">
          No events found for this track and date range. Try changing your dates or selecting a different track.
        </p>
      </div>
    )
  }
```

**Recommendation:**
- Add actionable guidance:
  - "No events found. Try:"
    - "Expanding your date range"
    - "Selecting a different track"
    - "Checking LiveRC for new events" (if not already checked)
- Add visual icon or illustration
- Link to helpful actions

**Priority:** P1 - User guidance

---

### 3.4 Import Status Feedback Could Be Better

**Issue:** Import status shows toast notification, but user must wait on Event Search page. No way to navigate away and come back.

**Recommendation:**
- Show import progress indicator
- Allow navigation away during import
- Show import status in Events list page
- Add "View imported events" link after successful import

**Priority:** P1 - User feedback

---

### 3.5 Events Page Empty State for New Users

**Issue:** New users landing on `/events` see empty state with no guidance.

**Current Code:**
```122:126:src/components/events/EventsPageClient.tsx
      {!loading && !error && events.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--token-text-muted)]">No imported events found.</p>
        </div>
      )}
```

**Recommendation:**
- Add prominent "Search for events" button
- Explain that events must be imported first
- Link to `/event-search`

**Priority:** P1 - User guidance

---

### 3.6 Dashboard Event Overview Requires Extra Click

**Issue:** Dashboard shows event overview, but user must click chart icon to see full analysis.

**Current Code:**
```60:67:src/components/dashboard/EventOverview.tsx
          <Link
            href={`/events/analyse/${eventId}`}
            className="flex-shrink-0 p-2 rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="View full event analysis"
          >
            <ChartIcon size={20} />
          </Link>
```

**Recommendation:**
- Make entire event overview card clickable
- Or add prominent "View Full Analysis" button
- Chart icon is not discoverable

**Priority:** P1 - Discoverability

---

### 3.7 Registration Auto-Login Could Fail Silently

**Issue:** Registration succeeds but auto-login might fail, redirecting to login with `?registered=true` query param that's not handled.

**Current Code:**
```152:172:src/app/register/page.tsx
      // Auto sign in after registration using NextAuth v5 client API
      try {
        await signIn("credentials", {
          email,
          password,
          redirect: false,
        })
        router.push("/welcome")
        router.refresh()
      } catch (signInError) {
        // Registration succeeded but auto-login failed, redirect to login
        logger.warn("Registration succeeded but auto-login failed", {
          error: signInError instanceof Error
            ? {
                name: signInError.name,
                message: signInError.message,
              }
            : String(signInError),
        })
        router.push("/login?registered=true")
      }
```

**Recommendation:**
- Handle `?registered=true` query param in login page
- Show success message: "Registration successful! Please sign in."
- Or retry auto-login with better error handling

**Priority:** P1 - User feedback

---

### 3.8 No "Recent Events" or "Continue Where You Left Off"

**Issue:** Dashboard doesn't show recent activity or quick access to recently viewed events.

**Recommendation:**
- Add "Recent Events" section to dashboard
- Show last 3-5 events user viewed
- Quick access to continue analysis

**Priority:** P1 - User convenience

---

### 3.9 Track Modal Missing Focus Trap

**Issue:** The track selection modal sets ESC handling and autofocus, but there is no focus trap. Pressing Tab immediately escapes to the page underneath, breaking keyboard navigation for accessibility users.

**Current State:**
- Modal has ESC key handling
- Modal has autofocus on first element
- No focus trap implementation
- Tab key escapes modal to underlying page

**Impact:**
- Accessibility violation (WCAG 2.1.2 - Keyboard Accessible)
- Keyboard users get lost mid-selection
- Violates workflow specification requirement (docs/frontend/liverc/user-workflow.md lines 150-181)
- Poor keyboard-only navigation experience

**Recommendation:**
- Add focus trap logic using `focus-trap-react` or similar library
- Trap focus within modal when open
- Ensure Tab cycles through modal elements only
- Return focus to trigger button when modal closes

**Priority:** P1 - Accessibility requirement, workflow specification violation

---

### 3.10 Mobile Sorting Controls Missing

**Issue:** Event table headers (and therefore sorting controls) disappear on mobile, while the workflow specification requires mobile-friendly sorting controls.

**Current Code:**
```100:123:src/components/event-search/EventTable.tsx
      {/* Desktop: Table Header (hidden on mobile) */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4 px-4 py-3 border-b border-[var(--token-border-default)]">
        <button
          type="button"
          onClick={() => handleSort("name")}
          className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
        >
          Event Name
          {sortField === "name" && (
            <span className="ml-2">{sortDirection === "asc" ? "↑" : "↓"}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSort("date")}
          className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
        >
          Event Date
          {sortField === "date" && (
            <span className="ml-2">{sortDirection === "asc" ? "↑" : "↓"}</span>
          )}
        </button>
        <div className="text-sm font-medium text-[var(--token-text-secondary)]">Status</div>
      </div>
```

**Impact:**
- Mobile users cannot sort events by date or name
- Violates workflow specification (docs/frontend/liverc/user-workflow.md lines 520-579)
- Poor mobile UX - users stuck with default sort order
- Inconsistent experience across devices

**Recommendation:**
- Add mobile-friendly "Sort by" dropdown or toggle control
- Show above event list on mobile screens
- Allow sorting by: Date (newest/oldest), Name (A-Z/Z-A)
- Display current sort selection clearly

**Priority:** P1 - Mobile UX, workflow specification violation

---

## 4. Medium Priority Enhancements (P2)

### 4.1 Loading States Could Be More Informative

**Issue:** Loading states are generic ("Loading events...") without progress indication.

**Recommendation:**
- Show what's happening: "Searching database...", "Checking LiveRC...", "Importing event data..."
- Add progress indicators for long operations
- Estimate time remaining for imports

**Priority:** P2 - User feedback

---

### 4.2 Event Search Could Remember Last Search

**Issue:** Event Search doesn't persist search criteria across sessions (only in localStorage, not across devices).

**Recommendation:**
- Save search history server-side
- Show "Recent searches" dropdown
- Quick re-search buttons

**Priority:** P2 - User convenience

---

### 4.3 Import Button Should Show Estimated Time

**Issue:** Users don't know how long import will take.

**Recommendation:**
- Show estimated time based on event size
- Progress indicator during import
- Allow cancellation

**Priority:** P2 - User feedback

---

### 4.4 Event Cards Could Show More Preview Info

**Issue:** Event cards on Events page show minimal info.

**Recommendation:**
- Show key metrics (driver count, lap count, date range)
- Show thumbnail or preview chart
- Show import status/date

**Priority:** P2 - Information density

---

### 4.5 Search Results Could Be Filterable

**Issue:** Event Search results can't be filtered or sorted beyond basic table sorting.

**Recommendation:**
- Add filters: date range, import status, track
- Add sorting options
- Add bulk actions (import multiple)

**Priority:** P2 - Power user feature

---

### 4.6 Navigation Could Include "Events" Link

**Issue:** AuthenticatedNav only has Dashboard and Event Search, but not Events list.

**Recommendation:**
- Add "Events" link to navigation
- Or consolidate into dropdown menu

**Priority:** P2 - Navigation completeness

---

### 4.7 Welcome Page Could Show User Stats

**Issue:** Welcome page is completely empty except greeting.

**Recommendation:**
- Show user stats: "You've imported X events", "Last imported: [date]"
- Show recent activity
- Quick links to common actions

**Priority:** P2 - Personalization

---

### 4.8 Event Analysis Page Could Have "Back" Button

**Issue:** No easy way to go back to events list from analysis page.

**Recommendation:**
- Add "Back to Events" button in header
- Or make breadcrumb more prominent

**Priority:** P2 - Navigation convenience

---

### 4.9 Import Could Show What Data Will Be Imported

**Issue:** Users don't know what "laps_full" import depth means.

**Recommendation:**
- Show tooltip or info icon explaining import depth
- Preview what data will be available
- Show data size estimate

**Priority:** P2 - Transparency

---

### 4.10 Event Search Could Have "Quick Search" for Recent Tracks

**Issue:** Users must select track from full list every time.

**Recommendation:**
- Show "Recently searched tracks" at top
- Show "Favorite tracks" section
- Quick search by track name

**Priority:** P2 - Efficiency

---

### 4.11 Dashboard Could Show Import Progress

**Issue:** If user navigates away during import, no way to check status.

**Recommendation:**
- Show active imports in dashboard
- Notification system for completed imports
- Link to view imported event

**Priority:** P2 - User feedback

---

### 4.12 Event Analysis Could Remember Tab Selection

**Issue:** Tab selection (Overview/Drivers) resets on page reload.

**Recommendation:**
- Persist tab selection in URL: `/events/analyse/[eventId]?tab=drivers`
- Or save in localStorage
- Restore on page load

**Priority:** P2 - User convenience

---

### 4.13 Favourites Not Surfaced Outside Modal

**Issue:** Favourite tracks are only visible inside the track selection modal. The workflow specification suggests showing favourite chips above the form for quick re-selection.

**Current State:**
- Favourites are stored in localStorage
- Favourites can be toggled inside the modal
- No visual indication of favourites outside the modal
- Users must open modal to see/use favourites

**Impact:**
- Reduces value of starring tracks
- Violates workflow specification suggestion (docs/frontend/liverc/user-workflow.md lines 120-149)
- Extra taps required for frequent tracks
- No affordance that starring tracks matters

**Recommendation:**
- Render favourite track chips (read-only) beside the Track selector button
- Show chips above or below the form
- Make chips clickable to quickly select favourite track
- Visual indication that favourites exist and are useful

**Priority:** P2 - User efficiency, workflow specification alignment

---

## 5. Low Priority Suggestions (P3)

### 5.1 Keyboard Shortcuts

**Suggestion:** Add keyboard shortcuts (e.g., `/` to focus search, `g d` for dashboard, `g e` for events).

**Priority:** P3 - Power user feature

---

### 5.2 Onboarding Tour

**Suggestion:** Add interactive onboarding tour for new users explaining the workflow.

**Priority:** P3 - User education

---

### 5.3 Quick Actions Menu

**Suggestion:** Add floating action button or quick actions menu for common tasks.

**Priority:** P3 - Efficiency

---

### 5.4 Event Comparison

**Suggestion:** Allow comparing multiple events side-by-side.

**Priority:** P3 - Advanced feature

---

### 5.5 Saved Searches

**Suggestion:** Allow users to save search criteria for quick re-use.

**Priority:** P3 - User convenience

---

### 5.6 Dashboard Customization

**Suggestion:** Allow users to customize dashboard layout and widgets.

**Priority:** P3 - Personalization

---

## 6. Recommended User Journey Improvements

### 6.1 Ideal Flow: New User

1. **Landing** → Clear value proposition
2. **Register** → Simple form, auto-login
3. **Welcome/Dashboard** → **IMPROVED:** Show "Get Started" with prominent "Search for Events" button
4. **Event Search** → Search, import, **directly view analysis** (no "Select" step)
5. **Event Analysis** → Explore data

**Key Changes:**
- Welcome page redirects to dashboard OR shows clear next steps
- Dashboard "Import" card links to `/event-search`
- Event Search "Select" goes directly to analysis
- Remove sessionStorage dependency

---

### 6.2 Ideal Flow: Returning User

1. **Login** → Simple redirect (let middleware handle it)
2. **Dashboard** → Shows recent events, quick stats, "Search for Events" button
3. **Event Search** OR **Events List** → User chooses based on goal
4. **Event Analysis** → Direct access from either path

**Key Changes:**
- Simplify login redirect
- Dashboard shows recent activity
- Clear distinction between "search for new" vs "browse existing"

---

### 6.3 Navigation Structure Recommendation

```
Dashboard (Home)
├── Recent Events (quick access)
├── Get Started (new users)
└── Quick Stats

Event Search (Discover & Import)
├── Search by Track + Date
├── Import Events
└── → Direct to Analysis after import

Events (Browse Imported)
├── List of imported events
├── Filter/Sort
└── → Direct to Analysis on click

Event Analysis (View Data)
├── Overview Tab
├── Drivers Tab
└── Breadcrumb: Dashboard > Events > [Event Name]
```

---

## 7. Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. Fix welcome page (redirect or add guidance)
2. Fix dashboard "Import" card link
3. Change Event Search "Select" to go directly to analysis
4. Remove sessionStorage dependency
5. Simplify login redirect logic
6. Add breadcrumb navigation
7. Render CheckLiveRCButton component
8. Mount ImportPrompt component for bulk import
9. Implement complete status model (importing/failed states)
10. Fix Event Analysis tab inconsistencies (show all tabs or remove references)

### Phase 2: High Priority (Week 2-3)
1. Add active state to navigation
2. Improve empty states with guidance
3. Handle registration auto-login failure
4. Add "Recent Events" to dashboard
5. Make event overview card clickable
6. Improve import status feedback
7. Add focus trap to track selection modal
8. Add mobile sorting controls to event table

### Phase 3: Medium Priority (Month 2)
1. Improve loading states
2. Add search history
3. Show import progress/estimates
4. Enhance event cards
5. Add filters to search results
6. Add "Events" to navigation
7. Surface favourite tracks outside modal

### Phase 4: Low Priority (Future)
1. Keyboard shortcuts
2. Onboarding tour
3. Saved searches
4. Dashboard customization

---

## 8. Conclusion

The MRE application has a **solid foundation** but suffers from **workflow fragmentation**, **unclear navigation patterns**, and **workflow specification violations**. The primary issues are:

1. **Welcome page is a dead-end** - needs guidance or redirect
2. **Multiple competing entry points** - unclear which to use
3. **Fragile sessionStorage pattern** - should use URL parameters or direct navigation
4. **Indirect paths to analysis** - too many steps between search and viewing data
5. **Missing breadcrumbs** - hard to understand page hierarchy
6. **Complex login redirect** - should be simplified
7. **Missing components not rendered** - CheckLiveRCButton and ImportPrompt exist but aren't used
8. **Incomplete status model** - missing importing/failed states
9. **Event Analysis tabs inconsistent** - tabs hidden but referenced in copy
10. **Workflow specification violations** - several features don't match documented requirements

**Overall Grade:** C+ (Functional but needs significant UX improvements)

**Key Recommendation:** Focus on **streamlining the core user journey** from search → import → analysis. Make it **3 steps instead of 7**. Remove unnecessary intermediate pages and make navigation **direct and predictable**.

The application will be **significantly improved** by addressing the P0 and P1 issues, which will make the user experience **slick and intuitive** rather than requiring users to figure out the workflow themselves.

---

**End of Review**

