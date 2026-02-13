---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Comprehensive testing strategy and guidelines for MRE application
purpose:
  Defines the testing pyramid, testing tools, patterns, best practices, and
  guidelines for frontend, backend, and integration testing. Ensures consistent
  testing approach across the codebase and provides clear testing standards.
relatedFiles:
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
    (ingestion testing)
  - docs/roles/quality-automation-engineer.md (role responsibilities)
  - ingestion/pytest.ini (Python test configuration)
---

# Testing Strategy and Guidelines

**Last Updated:** 2025-01-27  
**Scope:** All testing across Next.js application and Python ingestion service

This document defines the comprehensive testing strategy for the MRE
application, including testing pyramid, tools, patterns, and best practices.

---

## Table of Contents

1. [Testing Pyramid](#testing-pyramid)
2. [Testing Tools and Frameworks](#testing-tools-and-frameworks)
3. [Test Organization and Structure](#test-organization-and-structure)
4. [Testing Patterns and Best Practices](#testing-patterns-and-best-practices)
5. [Frontend Testing Guidelines](#frontend-testing-guidelines)
6. [Backend Testing Guidelines](#backend-testing-guidelines)
7. [Integration Testing Approach](#integration-testing-approach)
8. [Test Coverage Requirements](#test-coverage-requirements)
9. [CI/CD Testing Requirements](#cicd-testing-requirements)
10. [Test Data Management](#test-data-management)

---

## Testing Pyramid

The MRE testing strategy follows the testing pyramid model:

```
        /\
       /  \      E2E Tests (Few)
      /____\
     /      \    Integration Tests (Some)
    /________\
   /          \  Unit Tests (Many)
  /____________\
```

### Layer Breakdown

1. **Unit Tests (Base - Many)**
   - Test individual functions and components in isolation
   - Fast execution, high coverage
   - Mock external dependencies

2. **Integration Tests (Middle - Some)**
   - Test interactions between components
   - Test API endpoints with database
   - Test service integrations

3. **E2E Tests (Top - Few)**
   - Test complete user workflows
   - Test critical paths end-to-end
   - Slower execution, high confidence

---

## Testing Tools and Frameworks

### Python Ingestion Service

**Framework:** pytest

**Configuration:** `ingestion/pytest.ini`

**Features:**

- Async test support (`asyncio_mode = auto`)
- Fixture-based testing
- HTML fixture management
- Coverage reporting

**Usage:**

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=ingestion

# Run specific test file
pytest tests/unit/test_event_parser.py

# Run with verbose output
pytest -v
```

### Next.js Application

**Placeholder:** Testing framework not yet implemented

**Recommended Tools:**

- **Unit Tests:** Vitest or Jest
- **Component Tests:** React Testing Library
- **E2E Tests:** Playwright or Cypress
- **API Tests:** Supertest or similar

**Future Configuration:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## Test Organization and Structure

### Python Ingestion Service

```
ingestion/
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Shared fixtures
│   ├── unit/                # Unit tests
│   │   ├── test_event_list_parser.py
│   │   ├── test_race_results_parser.py
│   │   └── ...
│   ├── integration/         # Integration tests
│   │   └── ...
│   └── fixtures/            # Test fixtures
│       └── liverc/
│           └── <event_id>/
│               ├── event.html
│               ├── race.*.html
│               └── metadata.json
```

### Next.js Application (Future)

```
src/
├── __tests__/              # Test files (co-located or separate)
│   ├── unit/
│   │   ├── core/
│   │   │   └── auth/
│   │   │       └── register.test.ts
│   │   └── lib/
│   │       └── api-utils.test.ts
│   ├── integration/
│   │   └── api/
│   │       └── v1/
│   │           └── auth.test.ts
│   └── e2e/
│       └── auth-flow.spec.ts
```

---

## Testing Patterns and Best Practices

### Test Naming Conventions

**Python (pytest):**

```python
def test_function_name_should_do_something():
    """Test description"""
    pass
```

**TypeScript/JavaScript:**

```typescript
describe("functionName", () => {
  it("should do something when condition is met", () => {
    // Test implementation
  })
})
```

### Arrange-Act-Assert Pattern

```typescript
// Arrange
const input = { email: "test@example.com", password: "password123" }
const expectedOutput = { id: "uuid", email: "test@example.com" }

// Act
const result = await registerUser(input)

// Assert
expect(result.success).toBe(true)
expect(result.user.email).toBe(expectedOutput.email)
```

### Mocking Strategies

**Mock External Dependencies:**

- Database calls (use test database or mocks)
- HTTP requests (use fixtures or mocks)
- File system operations
- External services

**Example (Python):**

```python
@pytest.fixture
def mock_db_session():
    """Mock database session"""
    return Mock()
```

**Example (TypeScript):**

```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))
```

### Test Isolation

- Each test should be independent
- Tests should not depend on execution order
- Clean up test data after each test
- Use transactions or test database for isolation

---

## Frontend Testing Guidelines

**Placeholder:** Frontend testing guidelines will be added when testing
framework is implemented.

### Component Testing

**Recommended:** React Testing Library

**Principles:**

- Test user behavior, not implementation
- Query by accessible elements (labels, roles)
- Avoid testing internal state
- Test accessibility

**Example (Future):**

```typescript
import { render, screen } from '@testing-library/react'
import RegisterForm from './RegisterForm'

it('should display validation error for missing email', async () => {
  render(<RegisterForm />)

  const submitButton = screen.getByRole('button', { name: /register/i })
  await userEvent.click(submitButton)

  expect(screen.getByText(/email is required/i)).toBeInTheDocument()
})
```

### Server Action Testing

**Recommended:** Test server actions in isolation

**Example (Future):**

```typescript
import { registerUser } from "@/core/auth/register"

it("should register user with valid input", async () => {
  const result = await registerUser({
    email: "test@example.com",
    password: "password123",
    driverName: "Test User",
  })

  expect(result.success).toBe(true)
  expect(result.user.email).toBe("test@example.com")
})
```

---

## Backend Testing Guidelines

### API Route Testing

**Recommended:** Test API routes with test database

**Pattern:**

```typescript
// Future example
import { POST } from "@/app/api/v1/auth/register/route"
import { NextRequest } from "next/server"

it("should return 201 on successful registration", async () => {
  const request = new NextRequest("http://localhost/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "test@example.com",
      password: "password123",
      driverName: "Test User",
    }),
  })

  const response = await POST(request)
  const data = await response.json()

  expect(response.status).toBe(201)
  expect(data.success).toBe(true)
})
```

### Business Logic Testing

**Location:** `src/core/<domain>/`

**Pattern:**

- Test core functions in isolation
- Mock database calls
- Test error cases
- Test edge cases

**Example:**

```typescript
import { registerUser } from "@/core/auth/register"
import * as repo from "@/core/users/repo"

vi.mock("@/core/users/repo")

it("should return error when email already exists", async () => {
  vi.mocked(repo.findUserByEmail).mockResolvedValue({
    id: "existing",
    email: "test@example.com",
  })

  const result = await registerUser({
    email: "test@example.com",
    password: "password123",
    driverName: "Test User",
  })

  expect(result.success).toBe(false)
  expect(result.error.code).toBe("EMAIL_ALREADY_EXISTS")
})
```

### Database Testing

**Strategy:**

- Use test database for integration tests
- Use transactions that rollback after tests
- Seed test data before tests
- Clean up after tests

**Placeholder:** Database testing utilities will be added when testing framework
is implemented.

---

## Integration Testing Approach

### API Integration Tests

**Scope:**

- Test API endpoints with real database
- Test authentication flows
- Test error handling
- Test data persistence

**Pattern:**

```typescript
// Future example
describe("POST /api/v1/auth/register", () => {
  beforeEach(async () => {
    await resetTestDatabase()
  })

  it("should create user and return 201", async () => {
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        driverName: "Test User",
      }),
    })

    expect(response.status).toBe(201)

    const user = await findUserByEmail("test@example.com")
    expect(user).toBeDefined()
  })
})
```

### Service Integration Tests

**Python Ingestion Service:**

- Test ingestion pipeline with fixtures
- Test database writes
- Test idempotency
- Test error recovery

**See:** `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`
for detailed ingestion testing strategy.

---

## Test Coverage Requirements

### Coverage Goals

**Placeholder:** Coverage requirements will be defined when testing framework is
implemented.

**Recommended Targets:**

- **Unit Tests:** 80%+ coverage for core business logic
- **Integration Tests:** Critical paths covered
- **E2E Tests:** Critical user workflows covered

### Coverage Tools

**Python:**

```bash
pytest --cov=ingestion --cov-report=html
```

**TypeScript (Future):**

```bash
vitest --coverage
```

---

## CI/CD Testing Requirements

### Required Test Stages

**Placeholder:** CI/CD pipeline configuration will be added.

**Recommended Stages:**

1. **Lint** - Code style and quality checks
2. **Type Check** - TypeScript type checking
3. **Unit Tests** - Fast unit test suite
4. **Integration Tests** - Integration test suite
5. **E2E Tests** - End-to-end test suite (optional, can run on schedule)

### Quality Gates

- All tests must pass before merge
- Coverage must not decrease
- No flaky tests allowed
- Fast feedback (< 10 minutes for full suite)

**See:** `docs/roles/quality-automation-engineer.md` for CI/CD responsibilities.

---

## Test Data Management

### Fixtures

**Python Ingestion Service:**

- HTML fixtures stored in `ingestion/tests/fixtures/liverc/`
- Fixtures organized by event ID
- Metadata files describe fixture contents
- Telemetry fixtures in `ingestion/tests/fixtures/telemetry/` (synthetic CSV,
  KML track templates). Generate with `ingestion/scripts/generate-telemetry-seed.py`. See [Telemetry Seed Data Guide](../telemetry/Design/Telemetry_Seed_Data_Guide.md)

**Next.js Application (Future):**

- Test data fixtures for database
- Mock API responses
- Test user accounts

### Test Database

**Strategy:**

- Separate test database
- Reset before each test suite
- Seed with minimal test data
- Use transactions for isolation

**Placeholder:** Test database setup will be documented when testing framework
is implemented.

---

## Related Documentation

- [Ingestion Testing Strategy](../architecture/liverc-ingestion/18-ingestion-testing-strategy.md) -
  Detailed ingestion testing
- [Integration Testing Guide](./integration-testing-guide.md) - Detailed
  integration testing guide
- [Telemetry Seed Data Guide](../telemetry/Design/Telemetry_Seed_Data_Guide.md) -
  Telemetry fixture creation and generator usage
- [Quality & Automation Engineer Role](../roles/quality-automation-engineer.md) -
  Role responsibilities
- [Contributing Guidelines](./CONTRIBUTING.md) - Testing requirements for
  contributions

---

**End of Testing Strategy Documentation**
