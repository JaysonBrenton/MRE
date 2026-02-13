---
created: 2026-01-16
creator: Documentation & Knowledge Steward
lastModified: 2026-01-16
description:
  Architecture documentation for car profiles and driver profiles features
purpose:
  Defines the architecture, components, and implementation patterns for car
  profiles and driver profiles features
relatedFiles:
  - src/core/car-profiles/ (car profiles core logic)
  - src/core/driver-profiles/ (driver profiles core logic)
  - src/app/api/v1/car-profiles/ (car profiles API)
  - src/app/api/v1/driver-profiles/ (driver profiles API)
  - docs/api/api-reference.md (API documentation)
  - docs/database/schema.md (database schema)
---

# Profiles Feature Architecture

**Status:** Core APIs and database models are implemented. The dashboard routes
(`/dashboard/car-profiles`, `/dashboard/driver-profiles`) currently render
informational placeholders while the CRUD UI is finalized.  
**Feature Scope:** Car profiles and driver profiles for user customization and
data management

This document describes the architecture and implementation of the car profiles
and driver profiles features in MRE version 0.1.1.

---

## Overview

The profiles feature allows users to create and manage:

- **Car Profiles:** User-defined car configurations with setup information
- **Driver Profiles:** User-defined driver profiles with preferences and
  transponder numbers

**Key Features:**

- Full CRUD operations for both profile types
- User-scoped access (users can only access their own profiles)
- JSON storage for flexible data (setupInfo, preferences)
- Mobile-safe architecture compliance

---

## Architecture Overview

Both car profiles and driver profiles follow the same architectural pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                             │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ Profile List │  │ Profile Form │                    │
│  └──────┬───────┘  └──────┬───────┘                    │
│         │                  │                            │
│         └──────────────────┘                            │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Layer    │
                    │ /api/v1/       │
                    │ car-profiles   │
                    │ driver-profiles│
                    └────────┬───────┘
                             │
                    ┌────────▼────────┐
                    │  Core Logic    │
                    │ src/core/      │
                    │ car-profiles/  │
                    │ driver-profiles│
                    └────────┬───────┘
                             │
                    ┌────────▼────────┐
                    │   Database     │
                    │   (Prisma)     │
                    └────────────────┘
```

---

## Car Profiles

### Database Schema

**Model:** `CarProfile`  
**Table:** `car_profiles`

| Field         | Type     | Description                        |
| ------------- | -------- | ---------------------------------- |
| `id`          | UUID     | Primary key                        |
| `userId`      | UUID     | Foreign key to User                |
| `name`        | String   | Profile name                       |
| `carType`     | String   | Car type (e.g., "Buggy", "Truggy") |
| `vehicleType` | String   | Vehicle type (e.g., "1/8 Nitro")   |
| `setupInfo`   | JSON     | Flexible setup information         |
| `createdAt`   | DateTime | Creation timestamp                 |
| `updatedAt`   | DateTime | Update timestamp                   |

**Relationships:**

- Belongs to `User` (cascade delete)
- Index on `userId` for fast user lookups

### Core Logic (`src/core/car-profiles/`)

#### `crud.ts`

Business logic functions:

- `getCarProfilesByUserId()` - Get all profiles for user
- `getCarProfileById()` - Get single profile (with ownership check)
- `createCarProfileForUser()` - Create new profile
- `updateCarProfileForUser()` - Update profile (with ownership check)
- `deleteCarProfileForUser()` - Delete profile (with ownership check)

**Business Rules:**

- Users can only access their own profiles
- All operations include ownership validation
- `setupInfo` is stored as JSON for flexibility

#### `repo.ts`

Database access layer (Prisma queries):

- All database operations centralized here
- Ownership checks implemented in queries

### API Endpoints (`src/app/api/v1/car-profiles/`)

**Base Path:** `/api/v1/car-profiles`

- `GET /api/v1/car-profiles` - List all profiles for authenticated user
- `POST /api/v1/car-profiles` - Create new profile
- `GET /api/v1/car-profiles/[id]` - Get single profile
- `PUT /api/v1/car-profiles/[id]` - Update profile
- `DELETE /api/v1/car-profiles/[id]` - Delete profile

**Authentication:** All endpoints require authentication  
**Authorization:** Users can only access their own profiles

---

## Driver Profiles

### Database Schema

**Model:** `DriverProfile`  
**Table:** `driver_profiles`

| Field               | Type     | Description         |
| ------------------- | -------- | ------------------- |
| `id`                | UUID     | Primary key         |
| `userId`            | UUID     | Foreign key to User |
| `name`              | String   | Profile name        |
| `displayName`       | String   | Display name        |
| `transponderNumber` | String?  | Transponder number  |
| `preferences`       | JSON     | User preferences    |
| `createdAt`         | DateTime | Creation timestamp  |
| `updatedAt`         | DateTime | Update timestamp    |

**Relationships:**

- Belongs to `User` (cascade delete)
- Index on `userId` for fast user lookups

### Core Logic (`src/core/driver-profiles/`)

#### `crud.ts`

Business logic functions:

- `getDriverProfilesByUserId()` - Get all profiles for user
- `getDriverProfileById()` - Get single profile (with ownership check)
- `createDriverProfileForUser()` - Create new profile
- `updateDriverProfileForUser()` - Update profile (with ownership check)
- `deleteDriverProfileForUser()` - Delete profile (with ownership check)

**Business Rules:**

- Users can only access their own profiles
- All operations include ownership validation
- `preferences` is stored as JSON for flexibility
- `transponderNumber` is optional

#### `repo.ts`

Database access layer (Prisma queries):

- All database operations centralized here
- Ownership checks implemented in queries

### API Endpoints (`src/app/api/v1/driver-profiles/`)

**Base Path:** `/api/v1/driver-profiles`

- `GET /api/v1/driver-profiles` - List all profiles for authenticated user
- `POST /api/v1/driver-profiles` - Create new profile
- `GET /api/v1/driver-profiles/[id]` - Get single profile
- `PUT /api/v1/driver-profiles/[id]` - Update profile
- `DELETE /api/v1/driver-profiles/[id]` - Delete profile

**Authentication:** All endpoints require authentication  
**Authorization:** Users can only access their own profiles

---

## Security and Authorization

### Ownership Validation

All profile operations include ownership validation:

- API routes verify `userId` matches authenticated user
- Core logic functions include ownership checks
- Database queries filter by `userId`

### Access Control

- **List Operations:** Only return profiles for authenticated user
- **Get Operations:** Return 404 if profile doesn't belong to user
- **Update Operations:** Return 404 if profile doesn't belong to user
- **Delete Operations:** Return 404 if profile doesn't belong to user

---

## Data Flow

### Create Profile Flow

1. **User Input** → Profile form component
2. **API Call** → POST to `/api/v1/{car|driver}-profiles`
3. **Validation** → API validates required fields
4. **Core Logic** → `create{Car|Driver}ProfileForUser()` called
5. **Database** → Profile created with `userId` from session
6. **Response** → Profile data returned to client
7. **UI Update** → Profile list updated

### Update Profile Flow

1. **User Input** → Profile form with existing data
2. **API Call** → PUT to `/api/v1/{car|driver}-profiles/[id]`
3. **Ownership Check** → Verify profile belongs to user
4. **Core Logic** → `update{Car|Driver}ProfileForUser()` called
5. **Database** → Profile updated
6. **Response** → Updated profile data returned
7. **UI Update** → Profile display updated

---

## JSON Storage

### Setup Info (Car Profiles)

Flexible JSON structure for car setup information:

```json
{
  "shockOil": "35wt",
  "tires": "Pro-Line Blockade",
  "suspension": {
    "front": "soft",
    "rear": "medium"
  }
}
```

### Preferences (Driver Profiles)

Flexible JSON structure for driver preferences:

```json
{
  "defaultView": "lap-times",
  "chartPreferences": {
    "colorScheme": "dark",
    "showGrid": true
  }
}
```

**Benefits:**

- Flexible schema without migrations
- Easy to extend with new fields
- Type-safe access in TypeScript

---

## Error Handling

### Validation Errors

- **Missing Required Fields:** Returns 400 with field list
- **Invalid UUID:** Returns 400 for invalid profile IDs
- **Invalid JSON:** Returns 400 for malformed setupInfo/preferences

### Authorization Errors

- **Not Authenticated:** Returns 401
- **Profile Not Found:** Returns 404 (includes ownership check)
- **Access Denied:** Returns 404 if profile doesn't belong to user

### Server Errors

- **Database Errors:** Returns 500 with error code
- **Unexpected Errors:** Returns 500 with error code

---

## Performance Considerations

### Database Queries

- **Indexed Lookups:** `userId` index for fast user profile queries
- **Single Query:** List operations use single query with user filter
- **Cascade Delete:** Efficient deletion when user is deleted

### API Performance

- **Minimal Data Transfer:** Only necessary fields returned
- **Efficient Validation:** Validation happens before database queries
- **Ownership Checks:** Single query with user filter

---

## Testing Considerations

### Unit Tests

- Core CRUD functions
- Ownership validation logic
- JSON validation

### Integration Tests

- API endpoint authentication
- API endpoint authorization
- CRUD operations end-to-end

### E2E Tests

- Profile creation flow
- Profile update flow
- Profile deletion flow
- Ownership validation

---

## Future Enhancements

### Potential Improvements

1. **Profile Templates:** Pre-defined profile templates
2. **Profile Sharing:** Share profiles with other users
3. **Profile Import/Export:** Import/export profile data
4. **Profile Versioning:** Track profile changes over time
5. **Profile Analytics:** Usage analytics for profiles
6. **Profile Validation:** Validate setupInfo/preferences structure

---

## Related Documentation

- [API Reference - Car Profiles Endpoints](../../api/api-reference.md#car-profiles-endpoints)
- [API Reference - Driver Profiles Endpoints](../../api/api-reference.md#driver-profiles-endpoints)
- [Database Schema - CarProfile Model](../../database/schema.md#carprofile)
- [Database Schema - DriverProfile Model](../../database/schema.md#driverprofile)
- [Mobile-Safe Architecture Guidelines](./mobile-safe-architecture-guidelines.md)

---

**End of Profiles Feature Architecture Documentation**
