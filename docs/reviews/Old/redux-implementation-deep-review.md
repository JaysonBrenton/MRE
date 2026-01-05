# Redux Implementation Deep Review

**Created:** 2025-01-27  
**Reviewer:** AI Code Review  
**Scope:** Complete Redux state management implementation  
**Status:** Analysis Complete

## Executive Summary

This review provides a comprehensive analysis of the Redux Toolkit
implementation in the My Race Engineer (MRE) application. The implementation
successfully migrated from React Context API to Redux Toolkit with redux-persist
for state persistence. While the core architecture is solid and follows Redux
Toolkit best practices, several critical issues, architectural concerns, and
optimization opportunities were identified.

**Overall Assessment:** The implementation is functional but requires attention
to race condition handling, initial state management, error recovery, and test
coverage before it can be considered production-ready.

---

## 1. Store Configuration & Architecture

### 1.1 Store Setup (`src/store/index.ts`)

**Strengths:**

- Proper use of `configureStore` from Redux Toolkit
- Correct SSR handling with noop storage adapters
- Appropriate middleware configuration with serializable check exclusions for
  redux-persist actions
- Clean separation between localStorage (UI preferences) and sessionStorage
  (dashboard state)
- TypeScript types exported correctly (`RootState`, `AppDispatch`)

**Issues Identified:**

1. **Store Instance Created at Module Level**

   ```typescript
   export const store = configureStore({...})
   ```

   - The store is created at module load time, which is standard for client-side
     Redux
   - However, in Next.js SSR context, this creates a singleton that persists
     across requests in development
   - **Risk:** Low in production (each request gets fresh module), but could
     cause state leakage in development hot-reload scenarios
   - **Recommendation:** Current approach is acceptable, but document this
     behavior

2. **SessionStorage Adapter Implementation**

   ```typescript
   const createSessionStorage = () => {
     if (typeof window === "undefined") {
       return createNoopStorage()
     }
     return {
       getItem(key: string): Promise<string | null> {
         return Promise.resolve(sessionStorage.getItem(key))
       },
       // ...
     }
   }
   ```

   - The sessionStorage adapter returns synchronous values wrapped in Promises
   - This is correct for redux-persist compatibility, but the synchronous nature
     means errors won't be caught as Promise rejections
   - **Risk:** Low - sessionStorage operations are synchronous and errors are
     rare
   - **Recommendation:** Add error handling for quota exceeded scenarios

3. **Persistence Configuration**
   - UI slice persists `density` and `isNavCollapsed` to localStorage (correct)
   - Dashboard slice only persists `selectedEventId` to sessionStorage
     (correct - avoids quota limits)
   - No versioning or migration strategy for persisted state
   - **Risk:** Medium - if state shape changes, persisted data could cause
     runtime errors
   - **Recommendation:** Add `version` to persist configs and implement
     migrations if state structure changes

### 1.2 Redux Provider Setup (`src/components/store/ReduxProvider.tsx`)

**Strengths:**

- Proper use of `PersistGate` for state rehydration
- `loading={null}` prevents flash of unhydrated state (good UX)
- Client component directive (`"use client"`) correctly applied

**Issues Identified:**

1. **No Loading State During Rehydration**
   - `PersistGate` uses `loading={null}`, which means no visual indication
     during rehydration
   - For complex applications, users might see stale UI briefly
   - **Risk:** Low - rehydration is typically fast (<100ms)
   - **Recommendation:** Consider a minimal loading indicator for slower devices
     or if state grows

2. **Provider Placement**
   - Provider is correctly placed in `(authenticated)/layout.tsx`, wrapping all
     authenticated routes
   - This ensures Redux is available throughout the authenticated app
   - **Status:** ✅ Correct implementation

---

## 2. Slice Implementations

### 2.1 UI Slice (`src/store/slices/uiSlice.ts`)

**Strengths:**

- Clean, simple slice with straightforward reducers
- Proper TypeScript typing with `PayloadAction`
- Immutable updates (leveraging Immer under the hood)
- All actions are pure and predictable

**Issues Identified:**

1. **No Selectors Exported**
   - Components access state directly:
     `useAppSelector((state) => state.ui.density)`
   - This creates coupling between components and state shape
   - **Risk:** Low - state shape is simple, but refactoring becomes harder
   - **Recommendation:** Export selectors for better encapsulation:
     ```typescript
     export const selectDensity = (state: RootState) => state.ui.density
     export const selectIsNavCollapsed = (state: RootState) =>
       state.ui.isNavCollapsed
     ```

2. **Initial State Values**
   - `density: "comfortable"` and `isNavCollapsed: false` are hardcoded
   - These should match the persisted defaults or the first-time user experience
   - **Status:** ✅ Acceptable - values are reasonable defaults

### 2.2 Dashboard Slice (`src/store/slices/dashboardSlice.ts`)

**Strengths:**

- Well-structured state interface
- Async thunks properly typed with `createAsyncThunk`
- Error handling with `rejectWithValue` for typed error responses
- Proper use of `AbortSignal` in thunks (signal parameter present)

**Critical Issues Identified:**

#### 2.2.1 Initial Loading State Issue

```typescript
const initialState: DashboardState = {
  selectedEventId: null,
  eventData: null,
  isEventLoading: false,
  eventError: null,
  recentEvents: [],
  isRecentLoading: true, // ⚠️ CRITICAL: Starts as true
}
```

**Problem:** `isRecentLoading` is initialized to `true`, but there's no
automatic fetch on store initialization. This means:

- On first render, components will see `isRecentLoading: true` even though no
  fetch has started
- Components that check `isRecentLoading` to show loading states will show
  spinners indefinitely until a fetch is triggered
- The loading state doesn't accurately reflect reality

**Impact:**

- Users may see loading spinners when no request is in flight
- Components must handle this initial state specially, adding complexity

**Recommendation:** Initialize `isRecentLoading: false` and let components
trigger the initial fetch explicitly (which `DashboardClient` already does
correctly on mount).

#### 2.2.2 Race Condition Handling - INCOMPLETE IMPLEMENTATION

```typescript
export const fetchEventData = createAsyncThunk<
  EventAnalysisSummary,
  string,
  { rejectValue: FetchEventError }
>(
  "dashboard/fetchEventData",
  async (eventId: string, { rejectWithValue, signal }) => {
    // signal is received but not fully utilized
    const response = await fetch(`/api/v1/events/${eventId}/summary`, {
      cache: "no-store",
      signal, // ✅ Signal is passed to fetch
    })
    // ...
  }
)
```

**Problem Analysis:**

1. **Signal Handling is Present but Incomplete**
   - The `signal` is passed to `fetch()`, which will abort requests when the
     thunk is cancelled
   - However, there's no explicit request ID tracking or comparison logic
   - The migration plan (Phase 3, Task 3) called for comparing `requestId` to
     prevent stale responses, but this wasn't implemented

2. **Component-Level Abort Logic**

   ```typescript
   // DashboardClient.tsx:82-92
   useEffect(() => {
     if (!selectedEventId) {
       return
     }
     const promise = dispatch(fetchEventData(selectedEventId))
     return () => {
       promise.abort() // ✅ Correct cleanup
     }
   }, [dispatch, selectedEventId])
   ```

   - Components manually abort thunks using `promise.abort()`
   - This works, but relies on component cleanup, which may not fire in all
     scenarios

3. **No Request ID Tracking**
   - Redux Toolkit's `createAsyncThunk` supports request IDs via `requestId` in
     thunk API
   - The implementation doesn't track or compare request IDs to ignore stale
     responses
   - **Risk:** If a component dispatches multiple thunks rapidly, responses
     could arrive out of order

**Impact:**

- **Medium Risk:** In normal usage, component cleanup prevents most race
  conditions
- **Edge Case:** If a user rapidly switches events, there's a window where stale
  responses could overwrite newer state
- The current implementation relies on React's cleanup, which is generally
  reliable but not guaranteed

**Recommendation:**

1. Implement request ID tracking in the thunk to ignore stale responses:
   ```typescript
   builder.addCase(fetchEventData.fulfilled, (state, action) => {
     // Only update if this response matches the current selectedEventId
     if (state.selectedEventId === action.meta.arg) {
       state.isEventLoading = false
       state.eventData = action.payload
       state.eventError = null
     }
   })
   ```
2. Consider using `condition` option in `createAsyncThunk` to prevent redundant
   requests

#### 2.2.3 Event Clearing Logic - UNUSED ACTION

```typescript
clearEvent: (state) => {
  state.selectedEventId = null
  state.eventData = null
  state.eventError = null
  state.isEventLoading = false
},
```

**Problem:** The `clearEvent` action is defined but analysis shows:

- `selectEvent(null)` is used instead of `clearEvent()` in
  `DashboardClient.tsx:100`
- The `clearEvent` action is tested but not actually used in production code
- This creates API surface area that's not used, which could confuse future
  developers

**Impact:** Low - functionality works, but inconsistent API

**Recommendation:** Either:

1. Use `clearEvent()` in `DashboardClient` instead of `selectEvent(null)` for
   semantic clarity
2. Remove `clearEvent` and ensure `selectEvent(null)` handles clearing correctly
   (which it does)

#### 2.2.4 Error Recovery - 404 Handling

```typescript
.addCase(fetchEventData.rejected, (state, action) => {
  state.isEventLoading = false
  state.eventError = action.payload?.message || action.error.message || "Failed to fetch event data"

  if (action.payload?.code === "NOT_FOUND") {
    state.selectedEventId = null  // ✅ Clears selection
    state.eventData = null
  }
})
```

**Problem Analysis:**

- ✅ **Good:** 404 errors clear `selectedEventId`, preventing users from being
  stuck on invalid events
- ⚠️ **Issue:** The cleared `selectedEventId` is persisted to sessionStorage,
  but the sessionStorage adapter doesn't remove the key when value becomes
  `null`
- **Impact:** On next page load, sessionStorage may still contain the invalid
  event ID, causing the error to recur

**Recommendation:**

- When `selectedEventId` becomes `null` due to 404, ensure sessionStorage is
  also cleared
- Redux-persist should handle this automatically, but verify the behavior
- Consider adding explicit cleanup in the reducer or using a `transform` in
  persist config

#### 2.2.5 Missing Selectors

Similar to UI slice, no selectors are exported. Components access state
directly:

```typescript
const selectedEventId = useAppSelector(
  (state) => state.dashboard.selectedEventId
)
const eventData = useAppSelector((state) => state.dashboard.eventData)
// ... repeated across multiple components
```

**Recommendation:** Export selectors for better maintainability:

```typescript
export const selectSelectedEventId = (state: RootState) =>
  state.dashboard.selectedEventId
export const selectEventData = (state: RootState) => state.dashboard.eventData
export const selectIsEventLoading = (state: RootState) =>
  state.dashboard.isEventLoading
// Memoized selectors for derived data
export const selectSelectedEvent = createSelector(
  [selectEventData],
  (eventData) => eventData?.event ?? null
)
```

---

## 3. Component Integration

### 3.1 Hook Usage (`src/store/hooks.ts`)

**Strengths:**

- ✅ Properly typed hooks exported (`useAppDispatch`, `useAppSelector`)
- ✅ Follows Redux Toolkit best practices
- ✅ Type safety ensures components can't misuse the store

**Status:** ✅ Excellent implementation

### 3.2 Component Patterns

**Analysis of Component Usage:**

1. **DashboardClient.tsx**
   - ✅ Correctly uses `useAppDispatch` and `useAppSelector`
   - ✅ Proper cleanup in `useEffect` for thunk cancellation
   - ✅ Multiple selectors used (could benefit from memoized selectors if
     performance becomes an issue)
   - ⚠️ Manual abort cleanup is good but could be enhanced with request ID
     tracking in thunks

2. **DashboardLayout.tsx**
   - ✅ Clean usage of selectors
   - ✅ Only reads state, no dispatch needed (correct separation)

3. **AdaptiveNavigationRail.tsx**
   - ✅ Uses `toggleNavCollapsed` action correctly
   - ✅ Reads state for collapse state

4. **CommandPalette.tsx**
   - ✅ Simple state read/write pattern
   - ✅ Correct action usage

**Overall Assessment:** Components use Redux correctly, but could benefit from
selector exports for better encapsulation.

---

## 4. Testing

### 4.1 Test Coverage Analysis

**Current Test Files:**

- `src/store/slices/__tests__/uiSlice.test.ts`
- `src/store/slices/__tests__/dashboardSlice.test.ts`

**Coverage Assessment:**

#### UI Slice Tests

- ✅ Tests all reducer actions
- ✅ Tests state transitions
- ✅ Uses proper test patterns
- ⚠️ Missing: Integration tests with persisted state
- ⚠️ Missing: Tests for persistence behavior

#### Dashboard Slice Tests

- ✅ Tests `selectEvent` reducer with various scenarios
- ✅ Tests `clearEvent` reducer
- ✅ Tests `fetchEventData` thunk with mock fetch
- ✅ Tests error handling (404 case)
- ⚠️ Missing: Tests for `fetchRecentEvents` thunk
- ⚠️ Missing: Tests for race conditions (rapid event switching)
- ⚠️ Missing: Tests for abort signal handling
- ⚠️ Missing: Tests for persistence/rehydration
- ⚠️ Missing: Tests for error recovery scenarios

**Critical Gaps:**

1. **No Integration Tests**
   - No tests verify store configuration works end-to-end
   - No tests for redux-persist integration
   - No tests for SSR compatibility

2. **No Component Tests with Store**
   - No `renderWithStore` helper utility
   - Components are not tested with Redux store
   - Migration plan (Phase 1, Task 7) called for this, but it wasn't implemented

3. **Limited Async Thunk Testing**
   - `fetchEventData` is tested, but `fetchRecentEvents` is not
   - No tests verify abort behavior
   - No tests for concurrent request handling

**Recommendations:**

1. Create `src/store/__tests__/test-utils.tsx` with `renderWithStore` helper
2. Add integration tests for store configuration
3. Add tests for redux-persist behavior
4. Add tests for `fetchRecentEvents` thunk
5. Add tests for race condition scenarios
6. Add component tests using the store helper

---

## 5. Performance Considerations

### 5.1 Selector Performance

**Current State:**

- No memoized selectors using `createSelector`
- Components re-render on any state change in their slice
- Multiple components subscribe to the same state values

**Analysis:**

- ✅ **Acceptable for current scale:** State is small and components are few
- ⚠️ **Future concern:** As state grows, multiple selectors in one component
  could cause unnecessary re-renders
- Example: `DashboardClient` uses 5 separate `useAppSelector` calls, each
  creating a subscription

**Recommendation:**

1. For current implementation: ✅ No changes needed (premature optimization)
2. For future growth: Use `createSelector` for derived/computed values
3. Consider combining multiple selectors into one when they're always used
   together:
   ```typescript
   const dashboardState = useAppSelector((state) => ({
     selectedEventId: state.dashboard.selectedEventId,
     eventData: state.dashboard.eventData,
     isEventLoading: state.dashboard.isEventLoading,
     eventError: state.dashboard.eventError,
   }))
   ```

### 5.2 Bundle Size

**Dependencies:**

- `@reduxjs/toolkit`: ~15KB gzipped
- `react-redux`: ~5KB gzipped
- `redux-persist`: ~3KB gzipped
- **Total:** ~23KB gzipped

**Assessment:** ✅ Acceptable trade-off for the benefits provided. Migration
plan correctly estimated this impact.

### 5.3 State Size

**Current State Shape:**

- UI slice: ~100 bytes (3 boolean/string values)
- Dashboard slice: Variable (eventData can be large, but not persisted)

**Persistence Impact:**

- Only `selectedEventId` (string) persisted to sessionStorage
- UI preferences (~50 bytes) persisted to localStorage
- **Total persisted:** < 200 bytes

**Assessment:** ✅ Excellent - minimal storage usage prevents quota issues

---

## 6. TypeScript Type Safety

### 6.1 Type Coverage

**Strengths:**

- ✅ `RootState` and `AppDispatch` types exported correctly
- ✅ Slice state interfaces properly typed
- ✅ Action payloads typed with `PayloadAction<T>`
- ✅ Async thunks properly typed with generics
- ✅ Typed hooks prevent misuse

**Issues Identified:**

1. **No Exported Action Types**
   - Actions are exported as functions, but types aren't exported
   - This makes it harder to type-check action creators in tests or middleware
   - **Impact:** Low - current usage doesn't require this
   - **Recommendation:** Export action types if middleware or advanced patterns
     are added:
     ```typescript
     export type UiActions = ReturnType<
       (typeof uiSlice.actions)[keyof typeof uiSlice.actions]
     >
     ```

2. **Thunk Return Types**
   - Thunk return types are correctly inferred
   - Error types are properly typed with `rejectValue`
   - **Status:** ✅ Good

**Overall Assessment:** ✅ Excellent TypeScript coverage with proper type safety
throughout.

---

## 7. Architecture & Design Patterns

### 7.1 State Structure

**Current Structure:**

```
RootState
  ├── ui
  │   ├── density
  │   ├── isNavCollapsed
  │   └── isCommandPaletteOpen
  └── dashboard
      ├── selectedEventId (persisted)
      ├── eventData (not persisted)
      ├── isEventLoading
      ├── eventError
      ├── recentEvents
      └── isRecentLoading
```

**Assessment:**

- ✅ Logical separation between UI and business state
- ✅ Appropriate persistence strategy (sessionStorage for temporary,
  localStorage for preferences)
- ✅ Flat structure (no unnecessary nesting)
- ✅ Good balance of granularity vs. simplicity

### 7.2 Action Naming & Organization

**Current Actions:**

- UI: `setDensity`, `setNavCollapsed`, `toggleNavCollapsed`,
  `openCommandPalette`, `closeCommandPalette`
- Dashboard: `selectEvent`, `clearEvent`

**Assessment:**

- ✅ Clear, descriptive action names
- ✅ Consistent naming patterns
- ✅ Actions follow domain language

### 7.3 Async Thunk Patterns

**Current Thunks:**

- `fetchEventData`: Fetches event summary data
- `fetchRecentEvents`: Fetches list of recent events

**Assessment:**

- ✅ Proper use of `createAsyncThunk`
- ✅ Error handling with `rejectWithValue`
- ✅ AbortSignal support (partial - see Race Conditions section)
- ⚠️ Could benefit from request deduplication
- ⚠️ No retry logic (may be intentional)

---

## 8. Critical Issues Summary

### 8.1 High Priority

1. **Initial Loading State (`isRecentLoading: true`)**
   - **Severity:** Medium
   - **Impact:** Components show loading state when no request is in flight
   - **Fix:** Change initial state to `false`

2. **Race Condition Handling - Incomplete**
   - **Severity:** Medium
   - **Impact:** Stale responses could overwrite newer state in edge cases
   - **Fix:** Add request ID comparison in fulfilled handlers

3. **Missing Test Coverage**
   - **Severity:** Medium
   - **Impact:** Bugs could be introduced without detection
   - **Fix:** Add comprehensive test suite (see Testing section)

### 8.2 Medium Priority

1. **No Selector Exports**
   - **Severity:** Low-Medium
   - **Impact:** Tight coupling between components and state shape
   - **Fix:** Export selectors from slices

2. **Unused `clearEvent` Action**
   - **Severity:** Low
   - **Impact:** API inconsistency
   - **Fix:** Use `clearEvent()` or remove it

3. **404 Error Persistence**
   - **Severity:** Low-Medium
   - **Impact:** Invalid event IDs may persist in sessionStorage
   - **Fix:** Verify redux-persist clears null values, or add explicit cleanup

### 8.3 Low Priority (Nice to Have)

1. **No Persist Versioning**
   - Add version to persist configs for future migrations

2. **No Memoized Selectors**
   - Add `createSelector` for derived values when performance becomes a concern

3. **No Request Deduplication**
   - Add `condition` to thunks to prevent duplicate requests

---

## 9. Recommendations

### 9.1 Immediate Actions (Before Production)

1. ✅ Fix `isRecentLoading` initial state (change to `false`)
2. ✅ Add request ID tracking in `fetchEventData` fulfilled handler
3. ✅ Add tests for `fetchRecentEvents` thunk
4. ✅ Verify 404 error cleanup clears sessionStorage

### 9.2 Short-Term Improvements (Next Sprint)

1. Export selectors from both slices
2. Create `renderWithStore` test utility
3. Add integration tests for store configuration
4. Add tests for persistence behavior
5. Standardize on `clearEvent()` vs `selectEvent(null)`

### 9.3 Long-Term Enhancements (Future)

1. Add persist versioning for state migrations
2. Implement memoized selectors when needed
3. Add request deduplication to thunks
4. Consider error boundary integration for thunk errors
5. Add performance monitoring for state updates

---

## 10. Comparison with Migration Plan

### 10.1 Completed Items

✅ Store configuration with Redux Toolkit  
✅ Redux Persist integration (localStorage + sessionStorage)  
✅ SSR handling with noop storage adapters  
✅ Typed hooks (`useAppDispatch`, `useAppSelector`)  
✅ UI slice migration  
✅ Dashboard slice migration  
✅ Context code removed  
✅ Components migrated to Redux

### 10.2 Incomplete/Partially Complete Items

⚠️ **Race condition handling (Phase 3, Task 3)**

- Signal support: ✅ Implemented
- Request ID comparison: ❌ Not implemented
- Abort handling: ⚠️ Partial (component-level only)

⚠️ **Testing (Phase 1, Task 7)**

- Unit tests: ✅ Partial (UI slice complete, dashboard slice partial)
- Integration tests: ❌ Not implemented
- `renderWithStore` helper: ❌ Not implemented
- Component tests: ❌ Not implemented

⚠️ **Documentation (Phase 4, Task 6)**

- Architecture docs: ⚠️ Partial (migration plan exists but status needs update)
- Code comments: ✅ Good

### 10.3 Deviations from Plan

1. **No Feature Flags**
   - Migration plan suggested feature flags for gradual rollout
   - Implementation went with direct migration (acceptable, but no rollback
     path)

2. **Testing Strategy**
   - Plan called for comprehensive test suite
   - Implementation has minimal test coverage
   - **Impact:** Higher risk of regressions

---

## 11. Conclusion

The Redux implementation in MRE is **functionally complete** and follows Redux
Toolkit best practices. The architecture is sound, TypeScript coverage is
excellent, and the migration from Context API was successful. However, several
**critical and medium-priority issues** need to be addressed before the
implementation can be considered production-ready.

**Key Strengths:**

- ✅ Clean architecture and state structure
- ✅ Proper TypeScript typing throughout
- ✅ Correct SSR handling
- ✅ Appropriate persistence strategy
- ✅ Good separation of concerns

**Key Weaknesses:**

- ❌ Incomplete race condition handling
- ❌ Initial state issues (`isRecentLoading`)
- ❌ Insufficient test coverage
- ❌ Missing selector exports (encapsulation concern)
- ❌ Some unused code (`clearEvent`)

**Overall Grade: B+ (Good implementation with room for improvement)**

**Recommendation:** Address the high-priority issues before production
deployment. The implementation is solid but needs refinement in error handling,
testing, and edge case scenarios.

---

## Appendix: Code Examples for Fixes

### A.1 Fix Initial Loading State

```typescript
// src/store/slices/dashboardSlice.ts
const initialState: DashboardState = {
  selectedEventId: null,
  eventData: null,
  isEventLoading: false,
  eventError: null,
  recentEvents: [],
  isRecentLoading: false, // Changed from true
}
```

### A.2 Add Request ID Tracking

```typescript
// src/store/slices/dashboardSlice.ts
.addCase(fetchEventData.fulfilled, (state, action) => {
  // Only update if this response matches the currently selected event
  if (state.selectedEventId === action.meta.arg) {
    state.isEventLoading = false
    state.eventData = action.payload
    state.eventError = null
  }
  // If eventId doesn't match, ignore this response (stale request)
})
```

### A.3 Export Selectors

```typescript
// src/store/slices/uiSlice.ts
import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "../index"

export const selectUiState = (state: RootState) => state.ui
export const selectDensity = (state: RootState) => state.ui.density
export const selectIsNavCollapsed = (state: RootState) =>
  state.ui.isNavCollapsed
export const selectIsCommandPaletteOpen = (state: RootState) =>
  state.ui.isCommandPaletteOpen
```

```typescript
// src/store/slices/dashboardSlice.ts
import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "../index"

export const selectDashboardState = (state: RootState) => state.dashboard
export const selectSelectedEventId = (state: RootState) =>
  state.dashboard.selectedEventId
export const selectEventData = (state: RootState) => state.dashboard.eventData
export const selectIsEventLoading = (state: RootState) =>
  state.dashboard.isEventLoading
export const selectEventError = (state: RootState) => state.dashboard.eventError
export const selectRecentEvents = (state: RootState) =>
  state.dashboard.recentEvents
export const selectIsRecentLoading = (state: RootState) =>
  state.dashboard.isRecentLoading

// Memoized selectors for derived data
export const selectSelectedEvent = createSelector(
  [selectEventData],
  (eventData) => eventData?.event ?? null
)

export const selectEventSummary = createSelector(
  [selectEventData],
  (eventData) => eventData?.summary ?? null
)
```

---

**End of Review**
