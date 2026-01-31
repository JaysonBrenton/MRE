---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Comprehensive persona documentation for MRE application
purpose: Defines detailed persona descriptions, user journeys, technical specifications, and UI mockups
         for all MRE personas: Driver, Admin, Team Manager, and Race Engineer. This document serves
         as the authoritative reference for understanding user types, their goals, pain points, and
         how the system supports each persona.
relatedFiles:
  - docs/user-stories/README.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/design/mre-ux-principles.md
---

# MRE Personas

**Status:** Authoritative  
**Scope:** All personas for MRE application  
**Purpose:** Comprehensive documentation of user personas, their goals, pain
points, user journeys, and technical specifications.

This document defines the four primary personas for the My Race Engineer (MRE)
application. Each persona represents a distinct user type with specific needs,
goals, and interaction patterns with the system.

---

## Persona Overview

MRE supports four personas:

1. **Driver**: Individual RC racer who participates in events and tracks their
   performance
2. **Admin**: System administrator with elevated privileges for managing the
   application
3. **Team Manager**: Manager of a team of one or more drivers, coordinates team
   activities
4. **Race Engineer**: AI-backed assistant providing setup and tuning guidance
   (future feature)

---

## 1. Driver Persona

### Persona Description

The Driver persona represents individual RC racers who participate in racing
events and want to track their performance, analyze race data, and improve their
lap times.

**Goals and Motivations:**

- Track personal race performance over time
- Analyze lap times and identify areas for improvement
- Discover events they participated in using fuzzy name matching
- View race results and compare performance with other drivers
- Understand where time is gained or lost during races

**Pain Points and Challenges:**

- Difficulty manually tracking race participation across multiple events
- Lack of centralized view of all race data
- Time-consuming to analyze race performance without tools
- Hard to identify patterns in performance across different tracks and
  conditions
- Manual data entry and organization of race results

**Use Cases and Scenarios:**

- Register account with driver name
- Automatically discover events they participated in via fuzzy matching
- View event analysis with lap-by-lap breakdowns
- Compare performance across different races
- Track improvement over time
- Access race data from mobile device at track

**Technical Proficiency Expectations:**

- Basic to intermediate: Comfortable with web applications and mobile apps
- May use the system primarily on mobile devices at the track
- Expects intuitive, simple interface with minimal learning curve

**Context of Use:**

- **When**: Before races (preparation), during races (quick reference), after
  races (analysis)
- **Where**: At home (desktop/laptop), at the track (mobile device)
- **How**: Quick access to race data, simple navigation, desktop-optimized
  design

### User Journey

**Registration → Persona Assignment Flow:**

1. User registers with email, password, driver name, and optional team name
2. System automatically assigns Driver persona
3. User is redirected to welcome page showing "Welcome back <Driver Name>"
4. System uses fuzzy matching to discover events where driver participated

**Discovering Events via Fuzzy Matching:**

1. User's `driverName` is normalized and stored in `User.normalizedName`
2. During event ingestion, Python service creates `UserDriverLink` and
   `EventDriverLink` records
3. System queries `EventDriverLink` where:
   - `userId` matches current user
   - `matchType` is `transponder`, `exact`, or `fuzzy`
   - Status is `confirmed` or `suggested` (via `UserDriverLink`)
4. Events are displayed to user with participation details

**Viewing Event Analysis:**

1. User navigates to event list or search
2. Selects an event they participated in
3. Views event analysis with charts, lap times, and performance metrics
4. Compares performance with other drivers in the race

---

## 2. Admin Persona

### Persona Description

The Admin persona represents system administrators who manage the MRE
application, including user management, event data, system health, and
administrative features.

**Goals and Motivations:**

- Manage user accounts and permissions
- Monitor system health and performance
- Control LiveRC ingestion processes
- View audit logs and system statistics
- Troubleshoot issues and maintain data quality

**Pain Points and Challenges:**

- Need efficient tools to manage large numbers of users
- Difficulty tracking system health and performance metrics
- Manual intervention required for data quality issues
- Lack of visibility into ingestion processes and errors
- Need for comprehensive audit trails

**Use Cases and Scenarios:**

- Access admin console after login
- View system statistics (users, events, tracks, database size)
- Manage users (view, edit, delete, promote/demote admins)
- Monitor ingestion jobs and logs
- View audit logs of all admin actions
- Check system health status

**Technical Proficiency Expectations:**

- Advanced: Comfortable with administrative interfaces and technical details
- Understands system architecture and data models
- Expects comprehensive tools and detailed information

**Context of Use:**

- **When**: During system administration, troubleshooting, monitoring
- **Where**: Primarily desktop/laptop for detailed views
- **How**: Access via admin console, comprehensive dashboard views

### User Journey

**Admin Login → Admin Console:**

1. Admin logs in with email/password
2. System detects `isAdmin=true` flag
3. Admin is automatically assigned Admin persona
4. Admin is redirected to `/admin` console
5. Admin sees welcome message: "Welcome back <administrator-name>"

**Accessing Admin Features:**

1. Admin views dashboard with system statistics
2. Navigates to user management section
3. Views, edits, or manages users
4. Monitors ingestion jobs and system health
5. Reviews audit logs for compliance

---

## 3. Team Manager Persona

### Persona Description

The Team Manager persona represents managers who coordinate teams of one or more
drivers. They oversee team activities, coordinate setup options, plan race
tactics, and analyze team performance data.

**Goals and Motivations:**

- Manage team of drivers and coordinate activities
- Analyze team performance across multiple drivers
- Coordinate setup options and tuning recommendations
- Plan race tactics and strategies
- Communicate with team members
- Track team progress and improvement

**Pain Points and Challenges:**

- Difficulty coordinating multiple drivers' data
- Lack of centralized team management tools
- Hard to compare performance across team members
- Manual coordination of setup changes and tactics
- No integrated communication with team members

**Use Cases and Scenarios:**

- View all team members (drivers in their team)
- Access team events and race data
- Coordinate setup options with drivers
- Plan race tactics and strategies
- Analyze team performance metrics
- Communicate with team members (future)

**Technical Proficiency Expectations:**

- Intermediate to advanced: Comfortable with data analysis and team coordination
  tools
- May use both desktop and mobile devices
- Expects comprehensive team management features

**Context of Use:**

- **When**: Before races (planning), during races (coordination), after races
  (analysis)
- **Where**: Desktop for detailed analysis, mobile for quick coordination
- **How**: Team dashboard, communication tools, data analysis interfaces

### User Journey

**Team Manager Assignment:**

1. User account is created with `isTeamManager=true` flag
2. System automatically assigns Team Manager persona
3. Team Manager's `teamName` is used to identify team members
4. System queries all users with matching `teamName` (excluding Team Manager)

**Managing Team Members:**

1. Team Manager navigates to team management section
2. Views list of all team members (drivers in their team)
3. Accesses team events and race data
4. Analyzes team performance metrics
5. Coordinates setup options and race tactics (future)

**Future Collaboration Features:**

- Communication with team members via in-app messaging
- Setup options and tuning recommendations sharing
- Race tactics planning and strategy coordination
- Team data analysis and performance tracking
- Integration with Race Engineer persona for AI-assisted guidance

---

## 4. Race Engineer Persona

### Persona Description

The Race Engineer persona is an AI-backed assistant that provides guidance on
setup and tuning of RC cars to improve performance. This persona is selectable
by users and provides intelligent recommendations based on race data and
telemetry.

**Goals and Motivations:**

- Receive AI-powered setup recommendations
- Get tuning guidance based on race performance
- Understand how setup changes affect performance
- Optimize car configuration for different track conditions
- Learn from data-driven insights

**Pain Points and Challenges:**

- Lack of expert knowledge for setup optimization
- Difficulty understanding how setup changes affect performance
- Time-consuming trial-and-error approach to tuning
- Need for personalized recommendations based on driving style
- Limited access to expert race engineers

**Use Cases and Scenarios:**

- Select Race Engineer persona from available personas
- Ask questions about setup options
- Receive recommendations based on race data
- Get tuning guidance for specific track conditions
- Understand performance impact of setup changes
- Access AI-powered insights and analysis

**Technical Proficiency Expectations:**

- Basic to intermediate: Comfortable with AI assistants and recommendations
- May use voice or text input for queries
- Expects natural language interaction

**Context of Use:**

- **When**: Before races (setup planning), between races (tuning), after races
  (analysis)
- **Where**: Mobile device at track, desktop for detailed analysis
- **How**: Conversational interface, recommendation cards, setup wizards

### User Journey

**Selecting Race Engineer Persona:**

1. User navigates to persona management section
2. Views available personas (Driver, Admin, Team Manager, Race Engineer)
3. Selects Race Engineer persona
4. System updates user's `personaId` to Race Engineer
5. User gains access to AI assistant features

**Using AI Assistant (Future):**

1. User asks question about setup or tuning
2. AI analyzes user's race data and performance
3. AI provides personalized recommendations
4. User implements recommendations
5. System tracks performance changes
6. AI learns from results and improves recommendations

---

## Technical Specification

### Database Schema

**Persona Model:**

```prisma
enum PersonaType {
  driver
  admin
  team_manager
  race_engineer
}

model Persona {
  id          String      @id @default(uuid())
  type        PersonaType @unique
  name        String
  description String
  permissions Json?       // Permissions/access levels
  preferences Json?       // Default preferences
  metadata    Json?       // Additional metadata (e.g., AI config for Race Engineer)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  users User[]

  @@map("personas")
}
```

**User Model Updates:**

```prisma
model User {
  // ... existing fields ...
  personaId      String?  @map("persona_id")
  persona        Persona? @relation(fields: [personaId], references: [id], onDelete: SetNull)
  isTeamManager  Boolean  @default(false) @map("is_team_manager")

  // ... rest of model ...

  @@index([personaId])
  @@index([isTeamManager, teamName])
}
```

### API Contracts

**GET /api/v1/personas** Returns list of all available personas.

**Response:**

```typescript
{
  success: true,
  data: Persona[]
}
```

**GET /api/v1/users/me/persona** Returns current user's assigned persona with
additional data based on persona type.

**Response:**

```typescript
{
  success: true,
  data: {
    persona: Persona,
    events?: Event[],        // For Driver persona
    teamMembers?: User[]     // For Team Manager persona
  }
}
```

**POST /api/v1/users/me/persona** Allows users to select Race Engineer persona
(other personas are auto-assigned).

**Request:**

```typescript
{
  personaId: string // Race Engineer persona ID
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    persona: Persona
  }
}
```

**GET /api/v1/personas/driver/events** Returns events where Driver persona
participated using fuzzy matching.

**Response:**

```typescript
{
  success: true,
  data: {
    events: Event[],
    participationDetails: {
      eventId: string,
      matchType: "transponder" | "exact" | "fuzzy",
      similarityScore: number
    }[]
  }
}
```

**GET /api/v1/personas/team-manager/team** Returns team members for Team Manager
persona.

**Response:**

```typescript
{
  success: true,
  data: {
    teamMembers: User[],
    teamName: string
  }
}
```

### Fuzzy Matching Algorithm

The Driver persona event discovery leverages existing fuzzy matching
infrastructure:

1. **User Registration**: `driverName` is normalized and stored in
   `User.normalizedName`
2. **Event Ingestion**: Python ingestion service creates `UserDriverLink` and
   `EventDriverLink` records
3. **Event Discovery**: Query `EventDriverLink` where:
   - `userId` matches current user
   - `matchType` is `transponder`, `exact`, or `fuzzy`
   - Status is `confirmed` or `suggested` (via `UserDriverLink`)

**Integration Points:**

- Uses existing `UserDriverLink` status (`confirmed`, `suggested`)
- Queries `EventDriverLink` to find events
- Filters by `EventDriverLinkMatchType` (transponder, exact, fuzzy)
- Leverages normalization functions (`Normalizer.normalize_driver_name`)

### Persona Assignment Logic

**Priority Order:**

1. Admin > Team Manager > Driver (if multiple flags set, Admin takes precedence)
2. Race Engineer can be manually selected by users

**Auto-Assignment Rules:**

- **Driver**: Automatically assigned to all new users during registration
- **Admin**: Automatically assigned when `isAdmin=true`
- **Team Manager**: Automatically assigned when `isTeamManager=true` and
  `teamName` is set
- **Race Engineer**: Manually selectable by users via API

---

## UI Mockups/Wireframes

### View-Only Persona Display Component

**Component**: `PersonaDisplay.tsx`

**Design:**

- Shows persona name and description
- Displays persona type badge with color coding:
  - Driver: Blue badge
  - Admin: Red badge
  - Team Manager: Green badge
  - Race Engineer: Purple badge
- Read-only view (no editing in v0.1.0)
- Mobile-responsive card layout

**Integration Points:**

- Welcome page: Display current persona below welcome message
- Dashboard header: Show persona badge in header
- User profile area: Display persona information (future)

### Persona Selection UI (Future)

**Component**: `PersonaSelector.tsx`

**Design:**

- Dropdown/radio selection interface
- Shows available personas with descriptions
- Only allows Race Engineer selection (Driver/Admin/Team Manager auto-assigned)
- Calls `POST /api/v1/users/me/persona` on selection
- Confirmation dialog before switching personas

**Note**: This component is deferred to future version per scope requirements.

---

## Team Manager Collaboration Features (Future)

The following features are planned for future releases to enhance Team Manager
persona capabilities:

### Communication Features

- In-app messaging with team members
- Team announcements and notifications
- Real-time chat during races
- Post-race debriefing tools

### Setup Options and Tuning

- Share setup sheets with team members
- Coordinate setup changes across team
- Track setup history and performance impact
- Setup recommendation engine

### Race Tactics Planning

- Pre-race strategy planning
- Real-time race tactics coordination
- Post-race tactics analysis
- Tactics library and templates

### Team Data Analysis

- Aggregate team performance metrics
- Compare performance across team members
- Identify team strengths and weaknesses
- Track team improvement over time

### Integration with Race Engineer

- AI-assisted team setup recommendations
- Personalized tuning guidance for each driver
- Team-wide performance optimization
- Data-driven team strategy development

---

## Related Documentation

- [User Stories README](../user-stories/README.md) - User types reference
- [MRE v0.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) - Feature scope
- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) -
  Technical architecture
- [MRE UX Principles](./mre-ux-principles.md) - UX design principles

---

## License

Internal use only. This specification governs persona definitions for MRE.
