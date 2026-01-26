# My Events Confirm/Reject Fix Implementation Plan

**Created**: 2026-01-21  
**Source Report**: `docs/reports/my-events-confirm-reject-review.md`  
**Owner**: Full Stack Engineering  
**Objective**: Fix the Confirm/Reject button functionality on the My Events page so that status changes persist and display correctly.

---

## 0. Executive Summary

The Confirm/Reject buttons on the My Events page appear to do nothing when clicked. Investigation revealed three distinct issues:

| Priority | Issue | Type | Root Cause |
|----------|-------|------|------------|
| **P0** | EventDriverLink not linked after confirm | Backend | `updateDriverLinkStatus()` doesn't link EventDriverLink records when UserDriverLink already exists |
| **P1** | Missing error handling on `/users/me` endpoint | API | No try/catch wrapper, errors return HTML instead of JSON |
| **P2** | Error state never clears | UI | `setError()` called but never reset, table hidden permanently |

---

## 1. Issue P0: EventDriverLink Not Being Linked

### 1.1 Problem Description

**Location**: `src/core/users/driver-links.ts` function `updateDriverLinkStatus()`

**Current Behavior**:
- Lines 244-294 (when `UserDriverLink` doesn't exist): Creates new `UserDriverLink` AND updates `EventDriverLink.user_driver_link_id`
- Lines 295-330 (when `UserDriverLink` already exists): Updates `UserDriverLink.status` but does NOT update `EventDriverLink.user_driver_link_id`

**Impact**: When a user has already confirmed one event for a driver, subsequent events with the same driver never get their `EventDriverLink.user_driver_link_id` populated. The `discoverDriverEvents()` query returns `"suggested"` as a fallback.

**Database Evidence**:
```
event_name                                        | user_driver_link_id | displayed_status
Cormcc 2025 Rudi Wensing Memorial, Clay Cup       | NULL                | suggested (fallback)
2025 Campbelltown Hobbies Winter Series Round-7   | NULL                | suggested (fallback)
2025 Campbelltown Hobbies Winter Series Round-6   | NULL                | suggested (fallback)
2025 Campbelltown Hobbies Winter Series Round-5   | NULL                | suggested (fallback)
Cormcc Club Day 20 July 2025                      | d52cfe88-...        | confirmed
Batemans Bay Rawspeed 2025                        | ac7496ce-...        | confirmed
```

### 1.2 Fix Implementation

**File**: `src/core/users/driver-links.ts`

**Change**: Add `EventDriverLink.updateMany()` call to the `else` branch (after line 330) to link any orphaned `EventDriverLink` records.

**Current Code** (lines 295-331):
```typescript
} else {
  // Update existing UserDriverLink
  const updateData: {
    status: "confirmed" | "rejected"
    confirmedAt?: Date | null
    rejectedAt?: Date | null
  } = {
    status: status as "confirmed" | "rejected",
  }

  if (status === "confirmed") {
    updateData.confirmedAt = new Date()
    updateData.rejectedAt = null
  } else {
    updateData.rejectedAt = new Date()
    updateData.confirmedAt = null
  }

  userDriverLink = await prisma.userDriverLink.update({
    where: {
      userId_driverId: {
        userId,
        driverId,
      },
    },
    data: updateData,
    include: {
      driver: true,
      events: {
        select: {
          id: true,
          matchType: true,
        },
      },
    },
  })
}
```

**Updated Code**:
```typescript
} else {
  // Update existing UserDriverLink
  const updateData: {
    status: "confirmed" | "rejected"
    confirmedAt?: Date | null
    rejectedAt?: Date | null
  } = {
    status: status as "confirmed" | "rejected",
  }

  if (status === "confirmed") {
    updateData.confirmedAt = new Date()
    updateData.rejectedAt = null
  } else {
    updateData.rejectedAt = new Date()
    updateData.confirmedAt = null
  }

  userDriverLink = await prisma.userDriverLink.update({
    where: {
      userId_driverId: {
        userId,
        driverId,
      },
    },
    data: updateData,
    include: {
      driver: true,
      events: {
        select: {
          id: true,
          matchType: true,
        },
      },
    },
  })

  // Link any orphaned EventDriverLink records to this UserDriverLink
  // This ensures events added after the UserDriverLink was created are properly linked
  await prisma.eventDriverLink.updateMany({
    where: {
      userId,
      driverId,
      userDriverLinkId: null,
    },
    data: {
      userDriverLinkId: userDriverLink.id,
    },
  })
}
```

### 1.3 Testing

**Unit Test**: `src/__tests__/core/users/driver-links.test.ts`

```typescript
describe('updateDriverLinkStatus', () => {
  it('should link orphaned EventDriverLinks when UserDriverLink already exists', async () => {
    // Setup: Create UserDriverLink for driver A with one EventDriverLink
    // Setup: Create additional EventDriverLink for same driver without linking
    
    // Act: Call updateDriverLinkStatus for the driver
    
    // Assert: All EventDriverLinks now have userDriverLinkId populated
  })

  it('should not affect EventDriverLinks for other drivers', async () => {
    // Setup: Create EventDriverLinks for different drivers
    
    // Act: Call updateDriverLinkStatus for one driver
    
    // Assert: Only that driver's EventDriverLinks are updated
  })
})
```

**Integration Test**: Manual verification via database query

```sql
-- Before fix: Some records have NULL user_driver_link_id
SELECT event_id, user_driver_link_id FROM event_driver_links 
WHERE user_id = '<user_id>' AND driver_id = '<driver_id>';

-- After clicking Confirm: All records should have user_driver_link_id populated
```

**E2E Test**: `src/__tests__/e2e/my-events-confirm.spec.ts`

```typescript
describe('My Events Confirm/Reject', () => {
  it('should update status column after clicking Confirm', async () => {
    // Navigate to My Events
    // Find a row with "suggested" status showing Confirm button
    // Click Confirm
    // Verify the row now shows "Confirmed" badge instead of buttons
  })
})
```

---

## 2. Issue P1: Missing Error Handling on `/users/me` Endpoint

### 2.1 Problem Description

**Location**: `src/app/api/v1/users/me/driver-links/events/[eventId]/route.ts`

**Current Behavior**: The `PATCH` handler calls `handleDriverLinkStatusPatch()` directly without try/catch. When an error is thrown (e.g., no driver link found), Next.js returns an HTML error page.

**Comparison**: The `/users/[userId]/driver-links/events/[eventId]/route.ts` endpoint correctly wraps the call in try/catch and uses `handleApiError()` (lines 96-121).

**Impact**: The UI calls `response.json()` on error responses, which fails when the body is HTML, causing a parse error and triggering the error state.

### 2.2 Fix Implementation

**File**: `src/app/api/v1/users/me/driver-links/events/[eventId]/route.ts`

**Current Code** (lines 20-48):
```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Request received")
  
  const session = await auth()
  
  console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Session check:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    userIdType: typeof session?.user?.id,
    userIdLength: session?.user?.id?.length,
  })

  if (!session || !session.user?.id) {
    console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] No session or user ID, returning 401")
    return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
  }

  const { eventId } = await params
  console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Calling handleDriverLinkStatusPatch:", {
    userId: session.user.id,
    eventId,
  })

  return handleDriverLinkStatusPatch(request, session.user.id, eventId)
}
```

**Updated Code**:
```typescript
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  
  console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Request received")
  
  try {
    const session = await auth()
    
    console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userIdType: typeof session?.user?.id,
      userIdLength: session?.user?.id?.length,
    })

    if (!session || !session.user?.id) {
      console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] No session or user ID, returning 401")
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { eventId } = await params
    console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Calling handleDriverLinkStatusPatch:", {
      userId: session.user.id,
      eventId,
    })

    return handleDriverLinkStatusPatch(request, session.user.id, eventId)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
```

### 2.3 Additional Fix: Return 404 for Missing Links

**File**: `src/core/users/driver-links.ts`

The `updateDriverLinkStatusByEvent()` function throws generic `Error` for missing links. This should be converted to a specific error type that `handleApiError` maps to 404.

**Option A**: Create custom error class

```typescript
// src/lib/errors.ts
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}
```

**Option B**: Check in handler and return 404 explicitly

```typescript
// In handleDriverLinkStatusPatch, catch the specific error message
try {
  const updatedLink = await updateDriverLinkStatusByEvent(userId, eventId, status)
  return successResponse({ link: updatedLink }, 200, `Driver link ${status} successfully`)
} catch (error) {
  if (error instanceof Error && error.message.includes("No driver link found")) {
    return errorResponse("NOT_FOUND", error.message, undefined, 404)
  }
  throw error // Re-throw for handleApiError to catch
}
```

### 2.4 Testing

**Unit Test**: Verify JSON error responses

```typescript
describe('PATCH /api/v1/users/me/driver-links/events/[eventId]', () => {
  it('should return JSON error when driver link not found', async () => {
    // Setup: Authenticated user with no driver links
    
    // Act: PATCH to non-existent event
    
    // Assert: Response is JSON with error code NOT_FOUND and status 404
  })

  it('should return JSON error on unexpected exceptions', async () => {
    // Setup: Mock updateDriverLinkStatusByEvent to throw
    
    // Act: PATCH request
    
    // Assert: Response is JSON with error code INTERNAL_ERROR
  })
})
```

---

## 3. Issue P2: Error State Never Clears

### 3.1 Problem Description

**Location**: `src/app/(authenticated)/dashboard/my-event/page.tsx`

**Current Behavior**:
- `setError(...)` is called in catch blocks (lines 272, 311, 354, 393)
- `setError(null)` is only called in the initial data fetch (line 138)
- Table rendering requires `!error` (line 558)

**Impact**: Once any error occurs, the table disappears permanently until page reload.

### 3.2 Fix Implementation

**File**: `src/app/(authenticated)/dashboard/my-event/page.tsx`

**Option A**: Clear error at the start of each action

Add `setError(null)` at the beginning of `handleConfirm`, `handleReject`, `handleBulkConfirm`, and `handleBulkReject`.

```typescript
const handleConfirm = async (eventId: string, e: React.MouseEvent) => {
  console.log("[MyEventPage] handleConfirm called:", { eventId })
  e.stopPropagation()
  
  setError(null) // Clear any previous error
  
  console.log("[MyEventPage] handleConfirm: Proceeding with confirmation")
  setUpdatingEvents((prev) => new Set(prev).add(eventId))
  // ... rest of function
}
```

Apply the same change to:
- `handleReject` (after line 283)
- `handleBulkConfirm` (after line 327)
- `handleBulkReject` (after line 366)

**Option B**: Make error dismissible (better UX)

Replace the error display with a dismissible alert:

```typescript
{/* Error State */}
{error && !loading && !hasNoDriverPersona && (
  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
    <p className="text-red-600 dark:text-red-400">Error: {error}</p>
    <button
      onClick={() => setError(null)}
      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
    >
      <span className="sr-only">Dismiss</span>
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  </div>
)}
```

And update the table rendering condition to show even when there's an error:

```typescript
{/* Events Table - show even if there's an error */}
{!loading && events.length > 0 && (
```

**Recommended**: Implement both Option A and Option B for best UX.

### 3.3 Testing

**Unit Test**: Verify error clears on retry

```typescript
describe('MyEventPage error handling', () => {
  it('should clear error when retrying action', async () => {
    // Setup: Render component with initial error state
    
    // Act: Click Confirm button
    
    // Assert: Error state is cleared before API call
  })

  it('should allow dismissing error manually', async () => {
    // Setup: Render component with error displayed
    
    // Act: Click dismiss button
    
    // Assert: Error is cleared, table is visible
  })
})
```

---

## 4. Implementation Order

### Phase 1: Backend Fix (P0)
1. Update `updateDriverLinkStatus()` to link orphaned EventDriverLinks
2. Write unit tests
3. Verify fix with database query
4. Test in Docker environment

### Phase 2: API Error Handling (P1)
1. Add try/catch to `/users/me` endpoint
2. Add 404 handling for missing driver links
3. Write unit tests for error responses
4. Verify JSON responses in browser DevTools

### Phase 3: UI Error Handling (P2)
1. Add `setError(null)` to action handlers
2. Implement dismissible error alert
3. Update table rendering condition
4. Manual testing of error scenarios

### Phase 4: Data Cleanup
1. Run one-time script to link orphaned EventDriverLink records

```sql
-- One-time data fix: Link orphaned EventDriverLinks to existing UserDriverLinks
UPDATE event_driver_links edl
SET user_driver_link_id = udl.id
FROM user_driver_links udl
WHERE edl.user_id = udl.user_id
  AND edl.driver_id = udl.driver_id
  AND edl.user_driver_link_id IS NULL;
```

---

## 5. Verification Checklist

### Backend Verification
- [ ] `updateDriverLinkStatus()` links EventDriverLinks in both branches
- [ ] Unit tests pass for new linking behavior
- [ ] Database shows all EventDriverLinks linked after confirm

### API Verification
- [ ] `/users/me` endpoint returns JSON for all error cases
- [ ] Missing driver link returns 404 with JSON body
- [ ] Unexpected errors return 500 with JSON body

### UI Verification
- [ ] Clicking Confirm updates status column immediately
- [ ] Clicking Reject updates status column immediately
- [ ] Bulk Confirm All updates all rows
- [ ] Bulk Reject All updates all rows
- [ ] Error messages are dismissible
- [ ] Table remains visible after transient errors

### E2E Verification
- [ ] Fresh user can confirm suggested event
- [ ] User with existing confirmations can confirm additional events
- [ ] Page refresh shows correct status
- [ ] Network errors don't break the page permanently

---

## 6. Rollback Plan

If issues are discovered after deployment:

1. **Backend rollback**: Revert `driver-links.ts` changes
2. **API rollback**: Revert route.ts error handling changes
3. **UI rollback**: Revert page.tsx error handling changes
4. **Data**: No data rollback needed (linking is additive, not destructive)

---

## 7. Related Documentation

- `docs/reports/my-events-confirm-reject-review.md` - Original defect report
- `docs/api/api-reference.md` - API contract (lines 2478-2483 for 404 behavior)
- `docs/architecture/error-handling.md` - Error handling patterns
