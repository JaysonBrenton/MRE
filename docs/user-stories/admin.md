---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: User stories for administrator features (admin login and console)
purpose: Defines user stories for administrator login and console functionality with detailed
         acceptance criteria, dependencies, and Definition of Done checklists.
relatedFiles:
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/design/mre-ux-principles.md
---

# Administrator Epic

This epic contains user stories for administrator features: administrator login and admin console access.

---

## Administrator Login

**As an** Administrator  
**I want** to log in  
**So that** I can access administrative features

### Priority
High

### Dependencies
- Admin account creation (backend-only, via seed script, database migration, or manual database update)

### Acceptance Criteria

1. **Admin Account Creation Restriction**
   - Administrator accounts MUST NOT be created via the registration flow
   - Admin creation must only occur through backend mechanisms:
     - Seed scripts (`prisma/seed.ts`)
     - Direct database updates
     - Secure migration scripts
   - Registration UI must not include admin account creation option
   - Registration API must not accept admin flag in request

2. **Login Form**
   - Administrator uses the same login form as regular users
   - Form must include:
     - Email or Username (required)
     - Password (required)
   - Form must follow same UX principles as user login
   - Form must use semantic dark theme tokens

3. **Authentication**
   - Form submission must call `POST /api/v1/auth/login` endpoint (same as user login)
   - Request body must include: email/username and password
   - Backend must verify credentials against database
   - Backend must check `isAdmin` flag on user record
   - Password verification must use secure comparison (Argon2id)
   - Session must be created upon successful authentication
   - Session must include `isAdmin: true` in session data

4. **Redirect Logic**
   - Upon successful login, administrator must be redirected to Admin Console (`/admin`)
   - Redirect must occur automatically without user interaction
   - Standard users must NOT be redirected to admin console (must go to `/welcome`)
   - Redirect logic must be based on `isAdmin` flag in session

5. **Error Handling**
   - Invalid credentials must display: "Invalid email/username or password." (generic message for security)
   - Network errors must display: "Unable to log in. Please check your connection and try again."
   - Server errors must display: "Unable to log in. Please try again."
   - All error messages must use error token colors
   - Error messages must not expose whether account exists or is admin (security best practice)
   - Error messages must not expose technical details

6. **Security Requirements**
   - Admin accounts must be clearly identified in database schema (`isAdmin` field)
   - Admin status must be verified server-side (never trust client)
   - Session must securely store admin status
   - No admin privileges granted based on client-side checks
   - Passwords must never be logged or exposed

7. **Mobile-First UI Requirements**
   - Login form must use single-column layout
   - All inputs must fill container width on mobile
   - All inputs must meet minimum 44px height requirement for touch targets
   - Submit button must be full-width on mobile
   - Form must be fully functional on mobile devices
   - No hover-only interactions

8. **UI/UX Compliance**
   - Form must follow UX principles: labels above inputs, consistent spacing, semantic tokens
   - Form must use standard outlined/secondary button style per UX guidelines
   - Button text must be "Sign in" or "Log In"
   - Form must follow dark theme guidelines
   - Form must maintain vertical rhythm using spacing scale

9. **Accessibility Requirements**
   - All form fields must be keyboard navigable
   - Labels must be properly associated with inputs
   - Screen reader support: validation errors must be announced
   - Focus indicators must be visible
   - Form must meet WCAG 2.1 AA contrast standards

10. **Architecture Compliance**
    - Business logic must reside in `src/core/auth/login.ts` (shared with user login)
    - UI component must be thin and call server action or API endpoint
    - No Prisma queries in UI components
    - No authentication logic in UI components
    - API endpoint must exist at `src/app/api/v1/auth/login/route.ts` (shared with user login)
    - Admin detection logic must be in core business logic, not UI

### Definition of Done

- [ ] Admin account creation restricted to backend-only methods
- [ ] Registration flow verified to not allow admin account creation
- [ ] Login form works for administrators (same form as users)
- [ ] API endpoint handles admin authentication correctly
- [ ] Business logic implemented in `src/core/auth/login.ts` with admin detection
- [ ] Password verification using Argon2id implemented
- [ ] Session creation includes `isAdmin` flag
- [ ] Redirect logic implemented (admin → `/admin`, user → `/welcome`)
- [ ] Error handling implemented for all error scenarios
- [ ] Security: generic error messages (no account enumeration)
- [ ] Admin status verified server-side only
- [ ] Mobile-first layout verified on multiple screen sizes
- [ ] Touch targets meet 44px minimum height requirement
- [ ] UI follows UX principles and design guidelines
- [ ] Dark theme tokens used throughout
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [MRE Alpha Feature Scope - Administrator Login](../specs/mre-v0.1-feature-scope.md#24-administrator-login-backend-only-creation)
- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
- [MRE UX Principles - Forms](../design/mre-ux-principles.md#4-forms-login-and-registration)
- [MRE Mobile UX Guidelines](../design/mre-mobile-ux-guidelines.md)

---

## Administrator Console

**As an** Administrator  
**I want** to see an admin console after login  
**So that** I know I've accessed administrative features

### Priority
Medium

### Dependencies
- Administrator Login story (administrators must log in before accessing console)

### Acceptance Criteria

1. **Welcome Message Display**
   - Page must display the following message exactly: "Welcome back <administrator-name>"
   - Administrator name must be dynamically inserted from admin account data
   - Message must be displayed prominently on the page
   - No variations or modifications to this message format are allowed

2. **Page Restrictions**
   - Page must contain NO additional admin UI beyond the welcome message:
     - No admin controls
     - No admin buttons
     - No admin menus
     - No admin widgets
     - No admin data visualization elements
     - No admin navigation elements (beyond standard layout navigation if present)
   - Page must remain minimal per Alpha scope requirements
   - No additional admin UI may exist during Alpha

3. **Layout Requirements**
   - Page must use single-column layout (mobile-first)
   - Welcome message must be centered horizontally
   - Welcome message must be centered vertically (using flex or grid)
   - Page must use consistent spacing scale per UX guidelines
   - Page must follow predictable page structure with header and main content wrapper

4. **Dark Theme Compliance**
   - Background must use `--token-surface` (no pure black)
   - Text must use `--token-text-primary`
   - No arbitrary colors or unapproved accent colors
   - Typography must follow dark theme guidelines exactly
   - No randomly sized typography

5. **Mobile-First Requirements**
   - Page must be fully functional on mobile devices
   - Layout must collapse gracefully on small screens
   - No hover-only interactions
   - Touch targets (if any) must meet 44px minimum height
   - Page must avoid large empty spaces above content on mobile

6. **Accessibility Requirements**
   - Page must use semantic HTML (`<main>` wrapper recommended)
   - Page must meet WCAG 2.1 AA contrast standards
   - Screen readers must read the welcome message clearly
   - No motion or animation
   - Focus indicators must be visible if any interactive elements exist

7. **Routing and Access Control**
   - Page must be accessible at `/admin` route
   - Page must be protected: only authenticated administrators can access
   - Unauthenticated users must be redirected to login page
   - Authenticated non-admin users must NOT be able to access this page (must be redirected or shown error)
   - Page must be accessible immediately after successful admin login

8. **Data Retrieval**
   - Administrator name must be retrieved from user session or database
   - User data must be fetched using business logic in `src/core/users/` (not in UI component)
   - No Prisma queries in UI component
   - Data fetching must follow architecture guidelines

9. **Architecture Compliance**
   - UI component must be thin (no business logic)
   - Business logic for user data retrieval must reside in `src/core/users/` if needed
   - Page must follow mobile-safe architecture guidelines
   - No browser-specific dependencies in core logic
   - Access control logic must be server-side (middleware or route handler)

10. **Error Handling**
    - If user session is invalid, user must be redirected to login page
    - If user is not an administrator, access must be denied (redirect or error)
    - If user data cannot be retrieved, appropriate error handling must occur
    - Error states must not expose technical details to user

### Definition of Done

- [ ] Admin console page implemented at `/admin` route
- [ ] Exact message format displayed: "Welcome back <administrator-name>"
- [ ] No additional admin UI elements beyond welcome message
- [ ] Single-column, mobile-first layout implemented
- [ ] Message centered horizontally and vertically
- [ ] Dark theme tokens used throughout (no hardcoded colors)
- [ ] Typography follows dark theme guidelines
- [ ] Mobile layout verified on multiple screen sizes
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Screen reader compatibility verified
- [ ] Route protection implemented (admin authentication required)
- [ ] Non-admin users cannot access admin console
- [ ] User data retrieval follows architecture guidelines
- [ ] No business logic in UI component
- [ ] Access control logic server-side
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [MRE Alpha Feature Scope - Administrator Login](../specs/mre-v0.1-feature-scope.md#24-administrator-login-backend-only-creation)
- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
- [MRE UX Principles](../design/mre-ux-principles.md)
- [MRE Mobile UX Guidelines](../design/mre-mobile-ux-guidelines.md)
- [MRE Dark Theme Guidelines](../design/mre-dark-theme-guidelines.md)

---

## Admin Dashboard Overview

**As an** Administrator  
**I want** to see a dashboard overview with system statistics and quick actions  
**So that** I can quickly understand system status and access common tasks

### Priority
High

### Acceptance Criteria
- Dashboard displays system statistics cards (users, events, tracks, database size)
- Health status widget shows overall system health
- Quick action cards for common tasks (trigger ingestion, view recent events)
- Recent activity feed shows latest admin actions
- All data updates in real-time or with refresh button
- Mobile-responsive card layout

---

## User Management

**As an** Administrator  
**I want** to manage users (view, edit, delete, promote/demote admins)  
**So that** I can maintain user accounts and control access

### Priority
High

### Acceptance Criteria
- View all users in sortable, filterable, paginated table
- Edit user details (driverName, teamName, email) via modal/form
- Delete users with confirmation dialog
- Promote/demote administrators (toggle isAdmin flag)
- Search and filter by email, driver name, admin status
- All actions logged to audit log

---

## System Statistics

**As an** Administrator  
**I want** to view system statistics and database metrics  
**So that** I can monitor system health and performance

### Priority
Medium

### Acceptance Criteria
- Dashboard cards showing user count, event count, track count, database size
- Database statistics (connection pool status, query performance, table sizes)
- Real-time updates with refresh button
- Mobile-responsive card layout

---

## Event Management

**As an** Administrator  
**I want** to manage ingested events (view, re-ingest, delete)  
**So that** I can maintain event data quality and troubleshoot ingestion issues

### Priority
Medium

### Acceptance Criteria
- View all events in sortable, filterable table with event details
- Re-ingest events (trigger re-ingestion for selected events)
- Delete events with confirmation and cascade delete handling
- Filter and sort by track, date range, ingestion status
- All actions logged to audit log

---

## Track Management

**As an** Administrator  
**I want** to manage tracks (view, follow/unfollow)  
**So that** I can control which tracks are monitored for events

### Priority
Medium

### Acceptance Criteria
- View all tracks with details and event counts
- Follow/unfollow tracks (toggle isFollowed flag)
- View events for specific tracks
- Filter and sort by name, source, follow status
- All actions logged to audit log

---

## LiveRC Ingestion Controls

**As an** Administrator  
**I want** to control LiveRC ingestion (trigger jobs, view status, view logs)  
**So that** I can manage data ingestion and troubleshoot issues

### Priority
Medium

### Acceptance Criteria
- Manual trigger for track sync or event ingestion
- View ingestion jobs (recent/active jobs list)
- View ingestion logs for specific operations
- Real-time status updates for running jobs
- All actions logged to audit log

---

## Audit Logs

**As an** Administrator  
**I want** to view audit logs of all admin actions and system events  
**So that** I can track changes and investigate issues

### Priority
High

### Acceptance Criteria
- View all audit log entries in sortable, filterable table
- Filter by user, action type, resource type, date range
- Expandable rows showing full audit log details (JSON)
- Export filtered logs (optional: CSV/JSON)
- Mobile-responsive table layout

---

## Health Checks

**As an** Administrator  
**I want** to view detailed system health checks  
**So that** I can monitor system status and identify issues

### Priority
High

### Acceptance Criteria
- Detailed health checks for database connectivity, ingestion service status, disk space, memory usage
- Color-coded status indicators (green/yellow/red)
- Individual component health status
- Manual refresh button
- Mobile-responsive layout

---

## Log Viewing

**As an** Administrator  
**I want** to view application logs (real-time and historical)  
**So that** I can troubleshoot issues and monitor system activity

### Priority
High

### Acceptance Criteria
- Real-time log streaming (tail -f style) using Server-Sent Events or WebSocket
- Paginated log viewing for browsing historical logs
- Search and filter by log level, service, date range, search term
- Support for multiple log sources (Next.js, ingestion service, database)
- Pretty-print JSON logs with syntax highlighting
- Mobile-responsive log viewer

