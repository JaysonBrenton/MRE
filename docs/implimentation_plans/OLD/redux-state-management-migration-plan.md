# Redux State Management Migration Plan

**Created:** 2025-01-27  
**Status:** Planning  
**Target Version:** Post 0.1.1 (Future Enhancement)

## Overview

This document outlines the migration from React Context API (`DashboardContext`)
to Redux Toolkit for state management in the MRE application. This migration
aims to improve state management scalability, enable powerful debugging tools,
simplify cross-page state persistence, and reduce complexity in the current
Context-based implementation.

**Related Documents:**

- `docs/implimentation_plans/codex-deep-review-remediation-plan.md` (Section 3.7
  references this migration)
- `docs/reviews/codex-deep-review.md` (Original review mentioning state
  management complexity)
- `docs/architecture/mobile-safe-architecture-guidelines.md` (Architecture
  standards)

## Goals

1. **Improved Debugging**: Enable Redux DevTools for time-travel debugging and
   state inspection
2. **Scalability**: Support future state management needs (undo/redo, optimistic
   updates, middleware)
3. **Cross-Page State**: Simplify state persistence across navigations and page
   boundaries
4. **Code Quality**: Reduce complexity in `DashboardContext.tsx` (currently 242
   lines with complex dependency management)
5. **Developer Experience**: Better TypeScript support and predictable state
   updates

> **Codex Review (2025-02-09):** The Redux implementation shipped
> (`src/store/index.ts`, `src/components/store/ReduxProvider.tsx`) and Context
> has already been removed, so this plan now serves as historical documentation
> rather than upcoming work. Please update the status/target version to reflect
> completion so future readers do not assume the migration is still pending.

## Current State Analysis

### Current Implementation

**Technology:** React Context API with `useState` and `useCallback`

**Location:** `src/components/dashboard/context/DashboardContext.tsx`

**State Managed:**

- `selectedEventId`: Currently selected event ID (persisted in sessionStorage)
- `eventData`: Event analysis summary data (EventAnalysisSummary)
- `isEventLoading`: Loading state for event data
- `eventError`: Error state for event fetching
- `recentEvents`: Array of recent events (ImportedEventSummary[])
- `isRecentLoading`: Loading state for recent events
- `density`: UI density preference ("compact" | "comfortable" | "spacious") -
  persisted in localStorage
- `isNavCollapsed`: Navigation sidebar collapse state - persisted in
  localStorage
- `isCommandPaletteOpen`: Command palette visibility state

**Actions/Functions:**

- `selectEvent(eventId: string | null)`: Selects an event and persists to
  sessionStorage
- `refreshEventData()`: Refetches current event data
- `fetchRecentEvents(eventScope?: "all" | "my")`: Fetches recent events list
- `setDensity(value: DensityPreference)`: Updates density preference and
  localStorage
- `setNavCollapsed(state: boolean)`: Updates nav collapse state and localStorage
- `toggleNavCollapsed()`: Toggles nav collapse state
- `openCommandPalette()` / `closeCommandPalette()`: Controls command palette
  visibility

**Components Using Context:**

- `DashboardLayout` (wraps all authenticated pages)
- `DashboardClient` (main dashboard component)
- Navigation components (via DashboardLayout)

**Current Pain Points:**

1. Manual localStorage/sessionStorage synchronization (lines 58-74, 167-179)
2. Complex dependency arrays in `useMemo` (17 dependencies, lines 213-231)
3. No built-in debugging tools (Redux DevTools)
4. State only accessible within Context Provider tree
5. Multiple interdependent state updates (selectedEventId triggers
   fetchEventData, etc.)
6. No middleware support for logging, analytics, or state transformations

### Dependencies

**Current:** None (using built-in React Context)

**Required for Migration:**

- `@reduxjs/toolkit`: Modern Redux with built-in best practices
- `react-redux`: React bindings for Redux
- `redux-persist`: For automatic localStorage/sessionStorage persistence
  (optional but recommended)
- TypeScript types included in packages

## Redux Architecture Design

### Store Structure

```typescript
// Proposed store structure
store / index.ts // Store configuration
hooks.ts // Typed hooks (useAppDispatch, useAppSelector)
slices / dashboardSlice.ts // Dashboard state (events, preferences)
uiSlice.ts // UI state (command palette, modals, etc.)
middleware / logger.ts // Development logging middleware
persistence.ts // Persist middleware configuration
```

### State Shape

```typescript
interface RootState {
  dashboard: {
    selectedEventId: string | null
    eventData: EventAnalysisSummary | null
    isEventLoading: boolean
    eventError: string | null
    recentEvents: ImportedEventSummary[]
    isRecentLoading: boolean
  }
  ui: {
    density: DensityPreference
    isNavCollapsed: boolean
    isCommandPaletteOpen: boolean
  }
}
```

> **Codex Review (2025-02-09):** Implementation mirrors this target shape:
> `src/store/index.ts` wires `redux-persist` with a localStorage-backed `ui`
> reducer and a sessionStorage-backed `dashboard` reducer, and the former
> `DashboardContext` consumers now rely on `useAppSelector`/`useAppDispatch`.
> This eliminated the manual persistence logic that previously lived inside the
> context provider.

### Slices to Create

1. **dashboardSlice** (`src/store/slices/dashboardSlice.ts`)
   - Event selection state
   - Event data (summary, top drivers, etc.)
   - Recent events list
   - Loading and error states
   - Async thunks for data fetching

2. **uiSlice** (`src/store/slices/uiSlice.ts`)
   - UI preferences (density, nav collapse)
   - Command palette state
   - Future: modal states, toast notifications, etc.

### Middleware

- **Redux Persist**: Auto-sync state to localStorage/sessionStorage
- **Redux DevTools**: Development debugging (built-in)
- **Logger**: Development-only logging middleware (optional)

**SSR/Hydration Considerations:**

- Redux Persist must be client-only to avoid SSR hydration errors
- Wrap `PersistGate` in a Client Component (marked with `"use client"`)
- Guard storage adapter access with `typeof window !== 'undefined'` checks
- Storage adapters should only execute in browser environment
- Store provider should handle SSR gracefully (return null or empty state during
  SSR)

## Migration Strategy

**Approach:** Incremental migration with feature flags (recommended)

**Rationale:**

- Allows testing in isolation
- Reduces risk of breaking existing functionality
- Enables rollback if issues arise
- Can be done incrementally without blocking other work

**Alternative:** Big bang migration (faster but higher risk)

### Migration Order

1. Setup Redux store alongside existing Context (both work simultaneously)
2. Migrate UI preferences first (simpler, less dependencies)
3. Migrate event selection and data (more complex, more dependencies)
4. Remove Context code after full migration verified
5. Cleanup and optimization

## Implementation Phases

### Phase 1: Setup & Foundation

**Goal:** Establish Redux infrastructure without changing existing functionality

**Tasks:**

1. Install dependencies:
   ```bash
   npm install @reduxjs/toolkit react-redux redux-persist
   npm install --save-dev @types/redux-persist
   ```
2. Create store structure:
   - `src/store/index.ts` - Store configuration
   - `src/store/hooks.ts` - Typed hooks
   - `src/store/slices/uiSlice.ts` - Basic UI slice
   - `src/store/slices/dashboardSlice.ts` - Basic dashboard slice structure
3. Configure store with:
   - Redux DevTools integration
   - Redux Persist middleware (for localStorage/sessionStorage)
   - TypeScript types
4. Create Redux Provider wrapper component
5. Add Redux Provider to app layout (alongside existing Context Provider)
6. Write unit tests for store configuration
7. Create smoke test proving Redux and Context can run side-by-side (tests both
   providers mounted simultaneously, no conflicts)

**Acceptance Criteria:**

- Redux store initializes successfully
- Redux DevTools connects in development
- Store structure matches design
- TypeScript compilation succeeds
- No breaking changes to existing functionality
- Tests pass
- Smoke test confirms Redux and Context providers can coexist without conflicts

**Estimated Effort:** 4-6 hours

**Dependencies:** None

---

### Phase 2: Migrate UI Preferences State

**Goal:** Migrate simple UI state (density, nav collapse) to Redux

**Tasks:**

1. Complete `uiSlice.ts` implementation:
   - Actions: `setDensity`, `setNavCollapsed`, `toggleNavCollapsed`
   - Reducers for all UI state
   - Selectors for accessing state
2. Configure Redux Persist for UI slice (localStorage)
3. Update `DashboardLayout` to use Redux hooks instead of Context for UI state
4. Verify persistence works (check localStorage)
5. Test navigation collapse and density changes
6. Update unit tests

**Note:** `DashboardLayout` is confirmed to be a Client Component (has
`"use client"` directive), so Redux hooks can be used directly without wrapper
components.

**Acceptance Criteria:**

- UI preferences work identically to Context implementation
- State persists to localStorage correctly
- Redux DevTools shows state changes
- No console errors or warnings
- Tests pass
- Context code for UI state can be removed (but keep for now)

**Estimated Effort:** 3-4 hours

**Dependencies:** Phase 1 complete

---

> **Codex Review (2025-02-09):** UI migration matches the plan:
> `DashboardLayout`, `AdaptiveNavigationRail`, `TopStatusBar`, `CommandPalette`,
> and `UserProfileModal` now consume UI state solely via
> `useAppSelector`/`useAppDispatch`, and `redux-persist` keeps density/nav
> settings in sync with localStorage. Manual storage reads remain only for
> non-Redux data (e.g., the guides accordion in `AdaptiveNavigationRail`).

### Phase 3: Migrate Event Selection & Dashboard Data

**Goal:** Migrate complex dashboard state (events, loading, errors) to Redux

**Tasks:**

1. Complete `dashboardSlice.ts` implementation:
   - Actions: `selectEvent`, `setEventData`, `setLoading`, `setError`, etc.
   - Async thunks: `fetchEventData`, `fetchRecentEvents`
   - Selectors for all dashboard state
2. Configure Redux Persist for dashboard slice:
   - Persist only `selectedEventId` to sessionStorage (not the full `eventData`
     payload to avoid quota limits)
   - Rehydrate `eventData` by fetching via thunk after store initialization
3. Implement race condition handling in async thunks:
   - Use `AbortController` for request cancellation
   - Compare `requestId` in `createAsyncThunk` to prevent stale responses from
     overwriting current selection
   - Cancel pending requests when user switches events quickly
4. Update `DashboardClient` to use Redux hooks:
   - Replace `useDashboardContext()` with `useAppSelector()` and
     `useAppDispatch()`
   - Update all state reads/writes to use Redux
5. Update components that use dashboard state
6. Test event selection, data fetching, error handling
7. Verify sessionStorage persistence (only `selectedEventId`, not `eventData`)
8. Verify race condition handling (rapid event switching doesn't show stale
   data)
9. Update unit tests and integration tests

> **Codex Review (2025-02-09):** Implementation in
> `src/store/slices/dashboardSlice.ts` and
> `src/components/dashboard/DashboardClient.tsx` hits the Redux wiring goals but
> leaves several regressions: (1) `selectEvent` never clears `eventData` when
> the user deselects an event (the new `clearEvent` action is unused), so
> `DashboardClient` keeps rendering the last summary even though
> `selectedEventId` is `null`; (2) `initialState.isEventLoading` stays `true`
> for first-time sessions, so the dashboard shows a perpetual skeleton until an
> event is picked; (3) 404s from `fetchEventData` no longer clear
> `selectedEventId`/sessionStorage, so users get stuck re-requesting the bad id;
> and (4) Task 3’s race-condition handling was skipped—while the thunk receives
> a `signal`, nothing aborts in-flight requests or ignores stale `requestId`s,
> so rapid event switching can still flash outdated data.

**Acceptance Criteria:**

- Event selection works identically to Context implementation
- Event data fetching works correctly
- Loading and error states handled properly
- State persists to sessionStorage correctly
- Redux DevTools shows all actions and state changes
- No console errors or warnings
- All tests pass
- Performance is acceptable (no regressions)

**Estimated Effort:** 8-12 hours

**Dependencies:** Phase 2 complete

---

### Phase 4: Remove Context Code & Cleanup

**Goal:** Remove old Context implementation and finalize migration

**Tasks:**

1. Remove `DashboardContextProvider` usage from `DashboardLayout`
2. Delete `src/components/dashboard/context/DashboardContext.tsx`
3. Remove Context-related imports and dependencies
4. Update any remaining references to Context
5. Clean up unused code
6. Update documentation:
   - Architecture docs if needed
   - Code comments
   - README if state management is documented
7. Performance validation:
   - Bundle size comparison
   - Runtime performance check
   - Memory usage (if applicable)
8. Final testing:
   - Full user flow testing
   - Edge cases
   - Error scenarios

**Acceptance Criteria:**

- No Context code remains
- All functionality works with Redux only
- Bundle size impact is acceptable (<50KB increase is reasonable)
- Performance is maintained or improved
- Documentation is updated
- All tests pass
- Code review approved

**Estimated Effort:** 4-6 hours

**Dependencies:** Phase 3 complete

---

> **Codex Review (2025-02-09):** The repository already satisfies Phase 4
> mechanically—`DashboardContext.tsx` is deleted, `DashboardLayout` now only
> wraps Redux consumers, and no components import the context. However, this
> document (and a few architecture/review docs) still reference the context
> file, so please update the written materials noted in Task 6.

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^2.0.0",
    "react-redux": "^9.0.0",
    "redux-persist": "^6.0.0"
  },
  "devDependencies": {
    "@types/redux-persist": "^4.3.1"
  }
}
```

### Package Size Impact

- `@reduxjs/toolkit`: ~15KB gzipped
- `react-redux`: ~5KB gzipped
- `redux-persist`: ~3KB gzipped
- **Total:** ~23KB gzipped (acceptable for the benefits gained)

## Testing Strategy

### Unit Tests

- Redux reducers (pure functions, easy to test)
- Redux selectors
- Async thunks (mock API calls)
- Store configuration

**Test Files:**

- `src/store/slices/__tests__/dashboardSlice.test.ts`
- `src/store/slices/__tests__/uiSlice.test.ts`
- `src/store/__tests__/index.test.ts`

> **Codex Review (2025-02-09):** None of these tests exist yet—the
> `src/store/slices` directory contains only the slice implementations, and
> there are no Vitest specs covering reducers, thunks, or store setup. Consider
> backfilling at least reducer/thunk tests plus a simple `renderWithStore`
> helper so the migration's behavior is verifiable.

### Integration Tests

- Store initialization
- Middleware behavior (persist, devtools)
- Thunk integration with API
- State persistence verification

### Component Tests

- Create shared `renderWithStore` helper utility (e.g.,
  `src/store/__tests__/test-utils.tsx`)
- Helper should wrap components with Redux Provider and pre-configured store
- Use Vitest + React Testing Library for component rendering
- Avoid ad-hoc provider setup across test suites - use the shared helper
  consistently
- Helper should support custom initial state for test isolation

### E2E Tests

- User flows that use state:
  - Select event on dashboard
  - Navigate between pages
  - Change UI preferences
  - Verify state persistence across page reloads
  - Verify state persistence across navigations

### DevTools Verification

- Redux DevTools connects correctly
- Actions are logged correctly
- State time-travel works
- State inspection works

## Rollback Plan

### Feature Flag Approach (Recommended)

Use environment variable or feature flag to switch between Context and Redux:

```typescript
// Feature flag
const USE_REDUX = process.env.NEXT_PUBLIC_USE_REDUX === "true"

// In component
const state = USE_REDUX
  ? useAppSelector((state) => state.dashboard.selectedEventId)
  : useDashboardContext().selectedEventId
```

**Benefits:**

- Easy A/B testing
- Gradual rollout
- Instant rollback if issues
- Can run both in parallel during migration

### Complete Rollback

If issues arise:

1. Revert commits related to Redux migration
2. Restore `DashboardContext.tsx` from git history
3. Remove Redux dependencies
4. Verify existing functionality works

**Time to Rollback:** < 30 minutes

## Timeline & Estimates

### Development Time

- **Phase 1 (Setup):** 4-6 hours
- **Phase 2 (UI State):** 3-4 hours
- **Phase 3 (Dashboard State):** 8-12 hours
- **Phase 4 (Cleanup):** 4-6 hours
- **Testing & QA:** 4-6 hours
- **Documentation:** 2-3 hours

**Total Estimated Effort:** 25-37 hours (3-5 days)

### Suggested Timeline

- **Week 1:** Phase 1 (Setup) + Phase 2 (UI State)
- **Week 2:** Phase 3 (Dashboard State)
- **Week 3:** Phase 4 (Cleanup) + Testing + Documentation

## Success Criteria

### Functional Requirements

- ✅ All existing functionality preserved (event selection, UI preferences, data
  fetching)
- ✅ State persistence works (localStorage, sessionStorage)
- ✅ No performance regressions
- ✅ No breaking changes for end users

### Technical Requirements

- ✅ Redux DevTools working in development
- ✅ TypeScript types correct and strict
- ✅ Bundle size increase is acceptable (<50KB)
- ✅ All tests passing (unit, integration, E2E)
- ✅ Code quality maintained or improved
- ✅ Documentation updated

### Developer Experience

- ✅ Easier to debug state issues (DevTools)
- ✅ Clearer state management patterns
- ✅ Better TypeScript support
- ✅ Reduced complexity in components

## Risks & Mitigations

### Risk 1: Breaking Existing Functionality

**Mitigation:**

- Incremental migration with thorough testing at each phase
- Feature flags for gradual rollout
- Comprehensive test coverage before removing Context

### Risk 2: Performance Regression

**Mitigation:**

- Performance testing before/after
- Monitor bundle size
- Use Redux Toolkit (optimized for performance)
- Code splitting if needed

### Risk 3: Learning Curve for Team

**Mitigation:**

- Good documentation
- Code examples
- Redux Toolkit is simpler than classic Redux
- DevTools make it easier to understand state

### Risk 4: Bundle Size Increase

**Mitigation:**

- Acceptable trade-off for benefits (~23KB)
- Can code-split if needed
- Tree-shaking should minimize impact

## Future Enhancements (Post-Migration)

Once Redux is established, consider:

1. **Undo/Redo Support**: Easy to add with Redux patterns
2. **Optimistic Updates**: Built-in support via Redux Toolkit
3. **Middleware for Analytics**: Track state changes for analytics
4. **State Normalization**: For complex nested data
5. **RTK Query**: If API state management needs grow
6. **Redux Saga**: If complex async workflows are needed (probably overkill for
   now)

## Notes

- This migration should be done **after** the codex remediation work (or in
  parallel if resources allow)
- Redux migration is **not urgent** - Context is working fine, this is an
  improvement/enhancement
- Consider doing this during a lower-priority development window
- Can be done incrementally without blocking other features
- Redux Toolkit makes this migration simpler than it would have been with
  classic Redux

## Related Documents

- Original Context:
  `docs/implimentation_plans/codex-deep-review-remediation-plan.md` (Section
  3.7)
- Architecture Guidelines:
  `docs/architecture/mobile-safe-architecture-guidelines.md`
- Current Implementation:
  `src/components/dashboard/context/DashboardContext.tsx`

---

**Status:** Planning  
**Last Updated:** 2025-01-27
