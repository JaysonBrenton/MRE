---
created: 2026-01-05
creator: Jayson Brenton
lastModified: 2026-01-05
description: Comprehensive style guide for TypeScript and React code in MRE
purpose:
  Establishes mandatory coding standards, naming conventions, and patterns for
  TypeScript and React development in the MRE project. Ensures consistency,
  maintainability, and clear code organization across all TypeScript and React
  code. These standards complement the file headers and commenting guidelines.
relatedFiles:
  - docs/standards/file-headers-and-commenting-guidelines.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/development/CONTRIBUTING.md
  - .prettierrc
  - eslint.config.mjs
---

# TypeScript and React Style Guide

**Last updated:** 2026-01-05  
**Owner:** Jayson Brenton  
**Applies to:** All TypeScript and React code in the MRE project

This document establishes mandatory coding standards, naming conventions, and
patterns for TypeScript and React development in the MRE project. These
standards ensure consistency, maintainability, and clear code organization.

All TypeScript and React code must comply with these guidelines.

---

## Table of Contents

1. [Naming Conventions](#1-naming-conventions)
2. [TypeScript Patterns](#2-typescript-patterns)
3. [React Component Patterns](#3-react-component-patterns)
4. [Import Organization](#4-import-organization)
5. [File Organization](#5-file-organization)
6. [Code Style Rules](#6-code-style-rules)
7. [Best Practices](#7-best-practices)

---

## 1. Naming Conventions

### 1.1 Files and Directories

**File Naming:**

- **Components**: `PascalCase.tsx` (e.g., `DashboardClient.tsx`,
  `EventSearchContainer.tsx`)
- **Utilities/Lib files**: `camelCase.ts` (e.g., `auth.ts`, `api-utils.ts`)
- **Types**: `camelCase.ts` or co-located with component (e.g., `types.ts`,
  `dashboard.types.ts`)
- **Hooks**: `use-kebab-case.ts` (e.g., `use-event-data.ts`, `use-auth.ts`)
- **Constants**: `UPPER_SNAKE_CASE.ts` or co-located (e.g., `API_CONSTANTS.ts`)
- **Tests**: `*.test.ts` or `*.spec.ts` (e.g., `auth.test.ts`, `login.spec.ts`)

**Directory Naming:**

- Use `kebab-case` for directories (e.g., `event-search/`, `dashboard/`,
  `api-utils/`)

### 1.2 Variables and Functions

**Variables:**

- Use `camelCase` for variables and function parameters
- Use descriptive names that indicate purpose
- Boolean variables should start with `is`, `has`, `should`, `can`, `will`

```typescript
// Good
const eventData = await fetchEventData()
const isAuthenticated = checkAuth()
const hasPermission = user.isAdmin
const shouldShowModal = isOpen && !isLoading

// Bad
const data = await fetch()
const auth = check()
const perm = user.isAdmin
const show = open && !loading
```

**Functions:**

- Use `camelCase` for function names
- Use verb-based names for functions that perform actions
- Use noun-based names for functions that return values

```typescript
// Good
function fetchUserData() {}
function calculateTotal() {}
function getUserById() {}
function validateEmail() {}

// Bad
function user() {}
function total() {}
function get() {}
function check() {}
```

**Constants:**

- Use `UPPER_SNAKE_CASE` for true constants (values that never change)
- Use `camelCase` for exported constants that might be modified

```typescript
// True constants
const MAX_RETRY_ATTEMPTS = 3
const API_BASE_URL = "https://api.example.com"
const DEFAULT_TIMEOUT = 5000

// Exported constants (may be modified)
export const defaultConfig = { timeout: 5000 }
export const apiEndpoints = { login: "/api/v1/auth/login" }
```

### 1.3 Components

**Component Names:**

- Use `PascalCase` for component names
- Use descriptive names that indicate purpose
- Match component name to file name

```typescript
// Good
export default function DashboardClient() {}
export function EventSearchContainer() {}
export function UserProfileCard() {}

// Bad
export default function Dashboard() {} // Too generic
export function Container() {} // Too generic
export function Card() {} // Too generic
```

**Props Interfaces:**

- Use `PascalCase` with descriptive suffix
- Prefer `Props` suffix for component props
- Use descriptive names for other interfaces

```typescript
// Good
interface DashboardClientProps {
  userId: string
  initialData?: EventData
}

interface UserProfileProps {
  user: User
  onUpdate: (user: User) => void
}

// Bad
interface Props {}
interface DashboardProps {} // Too generic
```

### 1.4 Types and Interfaces

**Type Definitions:**

- Use `PascalCase` for types and interfaces
- Use descriptive names
- Prefer `interface` for object shapes that may be extended
- Prefer `type` for unions, intersections, and computed types

```typescript
// Good - Interface for extensible object shapes
interface User {
  id: string
  email: string
  driverName: string
}

// Good - Type for unions
type Status = "pending" | "active" | "inactive"

// Good - Type for computed types
type UserWithoutPassword = Omit<User, "passwordHash">

// Bad
type User = {} // Should be interface if it's an object shape
interface Status = "pending" | "active" // Should be type for union
```

**Type Naming:**

- No suffix needed for interfaces (e.g., `User`, `Event`)
- Use `Type` suffix for type aliases when helpful (e.g., `EventType`,
  `StatusType`)
- Use descriptive suffixes for specific purposes (e.g., `Props`, `Config`,
  `Options`)

### 1.5 Hooks

**Hook Names:**

- Always start with `use` prefix
- Use `camelCase` after `use`
- Use descriptive names that indicate what the hook does

```typescript
// Good
function useEventData() {}
function useAuth() {}
function useLocalStorage() {}
function useDebounce() {}

// Bad
function getEventData() {} // Missing use prefix
function useData() {} // Too generic
function useHook() {} // Redundant
```

---

## 2. TypeScript Patterns

### 2.1 Type vs Interface

**Use `interface` when:**

- Defining object shapes that may be extended
- Defining component props
- Defining API response shapes
- Defining database model shapes

```typescript
// Good - Interface for extensible shapes
interface User {
  id: string
  email: string
}

interface AdminUser extends User {
  isAdmin: true
  permissions: string[]
}
```

**Use `type` when:**

- Defining unions or intersections
- Defining computed types
- Defining function types
- Defining mapped types

```typescript
// Good - Type for unions
type Status = "pending" | "active" | "inactive"

// Good - Type for computed types
type PartialUser = Partial<User>
type UserKeys = keyof User

// Good - Type for function signatures
type EventHandler = (event: Event) => void
```

### 2.2 Type Definitions Location

**Co-locate types when:**

- Types are only used in one file
- Types are closely related to a specific component

**Separate type files when:**

- Types are shared across multiple files
- Types represent domain models
- Types are part of a public API

```typescript
// Good - Co-located with component
// components/dashboard/DashboardClient.tsx
interface DashboardClientProps {
  userId: string
}

// Good - Shared types file
// types/dashboard.ts
export interface EventData {
  id: string
  name: string
}
```

### 2.3 Utility Types

Use TypeScript utility types when appropriate:

```typescript
// Good - Using utility types
type PartialUser = Partial<User>
type UserWithoutPassword = Omit<User, "passwordHash">
type UserEmail = Pick<User, "email">
type ReadonlyUser = Readonly<User>

// Good - Custom utility types
type Nullable<T> = T | null
type Optional<T> = T | undefined
```

### 2.4 Type Narrowing

Use proper type narrowing patterns:

```typescript
// Good - Type guards
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === "object" && obj !== null && "id" in obj && "email" in obj
  )
}

// Good - Discriminated unions
type Result<T> = { success: true; data: T } | { success: false; error: string }

function handleResult(result: Result<User>) {
  if (result.success) {
    // TypeScript knows result.data exists
    console.log(result.data)
  } else {
    // TypeScript knows result.error exists
    console.error(result.error)
  }
}
```

### 2.5 Generic Patterns

Use generics for reusable, type-safe code:

```typescript
// Good - Generic function
function fetchData<T>(url: string): Promise<T> {
  return fetch(url).then((res) => res.json())
}

// Good - Generic component props
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}
```

---

## 3. React Component Patterns

### 3.1 Server vs Client Components

**Server Components (Default):**

- Use for data fetching, database access, server-only logic
- Cannot use hooks, browser APIs, or event handlers
- Must be async if fetching data

```typescript
// Good - Server component
export default async function Dashboard() {
  const data = await fetchDashboardData()
  return <DashboardClient initialData={data} />
}
```

**Client Components:**

- Use `"use client"` directive at top of file
- Use for interactivity, hooks, browser APIs
- Use for components that need state or event handlers

```typescript
// Good - Client component
"use client"

import { useState } from "react"

export default function DashboardClient() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### 3.2 Component Structure

**Standard component structure:**

```typescript
/**
 * @fileoverview Component description
 * ... file header ...
 */

// 1. Imports (external first, then internal)
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/atoms/Button"
import { fetchData } from "@/lib/api"

// 2. Type definitions (if not in separate file)
interface ComponentProps {
  // props
}

// 3. Constants (if any)
const DEFAULT_VALUE = "default"

// 4. Component
export default function ComponentName({ prop1, prop2 }: ComponentProps) {
  // 5. Hooks
  const [state, setState] = useState()
  const router = useRouter()

  // 6. Effects
  useEffect(() => {
    // effect logic
  }, [])

  // 7. Event handlers
  const handleClick = () => {
    // handler logic
  }

  // 8. Render
  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

### 3.3 Props Patterns

**Props Interface:**

- Always define props interface
- Use descriptive names
- Mark optional props with `?`
- Provide default values when appropriate

```typescript
// Good
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: "primary" | "secondary"
  disabled?: boolean
}

export default function Button({
  label,
  onClick,
  variant = "primary",
  disabled = false,
}: ButtonProps) {
  // component
}
```

### 3.4 Hooks Patterns

**Custom Hooks:**

- Extract reusable logic into custom hooks
- Return objects for multiple values, arrays for pairs
- Use descriptive names

```typescript
// Good - Custom hook
function useEventData(eventId: string) {
  const [data, setData] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchEventData(eventId)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [eventId])

  return { data, loading, error }
}
```

**Hook Rules:**

- Only call hooks at the top level
- Only call hooks from React functions
- Use exhaustive dependencies in useEffect

```typescript
// Good
useEffect(() => {
  // effect
}, [dependency1, dependency2]) // All dependencies listed

// Bad
useEffect(() => {
  // effect
}, []) // Missing dependencies
```

### 3.5 Error Handling

**Error Boundaries:**

- Use error boundaries for component error handling
- Provide fallback UI
- Log errors appropriately

```typescript
// Good - Error boundary pattern
"use client"

import { ErrorBoundary } from "react-error-boundary"

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
    </div>
  )
}

export default function ComponentWithErrorBoundary() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <YourComponent />
    </ErrorBoundary>
  )
}
```

---

## 4. Import Organization

### 4.1 Import Order

Imports must be organized in the following order:

1. **External dependencies** (React, Next.js, third-party libraries)
2. **Internal absolute imports** (`@/` paths)
3. **Type imports** (using `type` keyword)
4. **Relative imports** (`./`, `../`)

```typescript
// 1. External dependencies
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createSlice } from "@reduxjs/toolkit"

// 2. Internal absolute imports
import { Button } from "@/components/atoms/Button"
import { fetchData } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"

// 3. Type imports
import type { User } from "@/types/user"
import type { EventData } from "@root-types/dashboard"

// 4. Relative imports
import { LocalComponent } from "./LocalComponent"
import { helperFunction } from "../utils/helpers"
```

### 4.2 Import Grouping

- Group imports by category
- Separate groups with blank lines
- Sort imports alphabetically within groups

```typescript
// Good - Grouped and sorted
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/atoms/Button"
import { fetchData } from "@/lib/api"

import type { User } from "@/types/user"

import { LocalComponent } from "./LocalComponent"
```

### 4.3 Type-Only Imports

Use `type` keyword for type-only imports:

```typescript
// Good - Type-only import
import type { User, EventData } from "@/types"

// Good - Mixed import
import { fetchUser } from "@/lib/api"
import type { User } from "@/types"

// Bad - Type imported without type keyword
import { User } from "@/types" // If User is only used as a type
```

---

## 5. File Organization

### 5.1 File Structure

**Component files should contain:**

1. File header (JSDoc)
2. Imports
3. Type definitions
4. Constants
5. Component(s)
6. Exports

**Utility files should contain:**

1. File header (JSDoc)
2. Imports
3. Type definitions
4. Constants
5. Functions
6. Exports

### 5.2 File Size

- Keep files focused and single-purpose
- Split large files (>300 lines) into smaller modules
- Extract reusable logic into separate files

### 5.3 Atomic Design

MRE uses an atomic design system for component organization. All UI components
live under `src/components/` with the following tier structure:

| Tier          | Path                                | Description                                           | Dependency Rule                                        |
| ------------- | ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| **Atoms**     | `@/components/atoms/`               | Smallest UI units (buttons, inputs, icons, badges)    | No component imports                                   |
| **Molecules** | `@/components/molecules/`           | Compositions of atoms (Modal, Tooltip, StandardTable) | May import atoms only                                  |
| **Organisms** | `@/components/organisms/<feature>/` | Sections of UI (tables, forms, charts)                | May import atoms, molecules, other organisms (acyclic) |
| **Templates** | `@/components/templates/`           | Page-level layout shells                              | May import organisms                                   |

**Dependency rule:** Atoms ← Molecules ← Organisms ← Templates ← Pages. No tier
may import from a higher tier.

See `docs/architecture/atomic-design-system.md` for tier definitions and import
rules, and
`docs/implimentation_plans/atomic-design-system-implementation-plan.md` for the
implementation plan.

### 5.4 Barrel Exports

Use barrel exports (`index.ts`) for public APIs when desired (optional):

```typescript
// components/atoms/index.ts
export { Button } from "./Button"
export { Input } from "./Input"
export { Modal } from "./Modal"
```

---

## 6. Code Style Rules

### 6.1 Formatting

All code must be formatted with Prettier. Run `npm run format` before
committing.

**Key formatting rules:**

- No semicolons
- Double quotes for strings
- 2-space indentation
- 100 character line width (80 for Markdown/JSON)
- ES5 trailing commas
- LF line endings

### 6.2 Spacing and Indentation

- Use 2 spaces for indentation
- No trailing whitespace
- Blank lines between logical sections
- Consistent spacing around operators

```typescript
// Good
const result = a + b
const user = { id: "1", name: "John" }

if (condition) {
  doSomething()
}

// Bad
const result = a + b
const user = { id: "1", name: "John" }
if (condition) {
  doSomething()
}
```

### 6.3 Arrow Functions

- Use arrow functions for callbacks and short functions
- Use regular functions for component definitions (optional)
- Always include parentheses for arrow function parameters

```typescript
// Good
const handleClick = () => {
  doSomething()
}

const items = data.map((item) => item.id)

// Bad
const handleClick = () => doSomething() // Too terse for complex logic
const items = data.map((item) => item.id) // Missing parentheses
```

---

## 7. Best Practices

### 7.1 Performance

- Use `React.memo` for expensive components
- Use `useMemo` and `useCallback` appropriately
- Avoid creating objects/functions in render

```typescript
// Good
const memoizedValue = useMemo(() => expensiveCalculation(a, b), [a, b])
const memoizedCallback = useCallback(() => {
  doSomething(a, b)
}, [a, b])

// Bad
const value = expensiveCalculation(a, b) // Recalculates on every render
const callback = () => doSomething(a, b) // New function on every render
```

### 7.2 Accessibility

- Use semantic HTML
- Include ARIA labels where needed
- Ensure keyboard navigation
- Maintain proper heading hierarchy

```typescript
// Good
<button aria-label="Close modal" onClick={handleClose}>
  <span aria-hidden="true">×</span>
</button>

// Bad
<div onClick={handleClose}>×</div>
```

### 7.3 Error Handling

- Handle errors gracefully
- Provide user-friendly error messages
- Log errors appropriately
- Use error boundaries for component errors

### 7.4 Testing

- Write tests for business logic
- Test user interactions
- Test error cases
- Keep tests focused and readable

---

## 8. Quick Reference Checklist

When writing TypeScript/React code, ensure:

- [ ] File follows naming conventions
- [ ] File header is present and complete
- [ ] Imports are organized correctly
- [ ] Types/interfaces are properly defined
- [ ] Component follows structure guidelines
- [ ] Props interface is defined
- [ ] Hooks follow rules and patterns
- [ ] Code is formatted with Prettier
- [ ] No ESLint errors
- [ ] Accessibility attributes included
- [ ] Error handling implemented

---

## 9. Related Documentation

- [File Headers and Commenting Guidelines](./file-headers-and-commenting-guidelines.md)
- [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
- [Contributing Guidelines](../development/CONTRIBUTING.md)
- [Component Creation Checklist](../development/COMPONENT_CREATION_CHECKLIST.md)

---

**End of TypeScript and React Style Guide**
