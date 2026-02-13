---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Comprehensive integration testing guide for MRE application
purpose:
  Provides detailed guidance for integration testing including setup, test data
  management, mocking strategies, database testing, API integration testing, and
  CI/CD integration. Supports consistent integration testing practices.
relatedFiles:
  - docs/development/testing-strategy.md (overall testing strategy)
  - ingestion/tests/integration/ (existing integration tests)
---

# Integration Testing Guide

**Last Updated:** 2025-01-27  
**Scope:** Integration testing for Next.js application and Python ingestion
service

This document provides comprehensive guidance for integration testing in the MRE
application.

---

## Table of Contents

1. [Integration Test Setup](#integration-test-setup)
2. [Test Data Management](#test-data-management)
3. [Mocking External Services](#mocking-external-services)
4. [Database Testing Strategies](#database-testing-strategies)
5. [API Integration Testing](#api-integration-testing)
6. [End-to-End Testing Approach](#end-to-end-testing-approach)
7. [CI/CD Integration Testing](#cicd-integration-testing)

---

## Integration Test Setup

### Test Environment

**Requirements:**

- Separate test database
- Test environment variables
- Isolated test containers
- Test fixtures and data

### Python Ingestion Service

**Existing Setup:**

- Tests in `ingestion/tests/integration/`
- Fixtures in `ingestion/tests/fixtures/`
- pytest configuration in `pytest.ini`

**Running Integration Tests:**

```bash
cd ingestion
pytest tests/integration/
```

### Next.js Application

**Placeholder:** Integration test setup will be implemented

**Recommended Setup:**

- Test database (separate from development)
- Test environment configuration
- Test utilities and helpers

---

## Test Data Management

### Test Fixtures

**Python Ingestion Service:**

- HTML fixtures stored in `ingestion/tests/fixtures/liverc/`
- Organized by event ID
- Metadata files describe fixture contents
- Telemetry fixtures in `ingestion/tests/fixtures/telemetry/` (synthetic CSV,
  KML track templates). See `docs/telemetry/Design/Telemetry_Seed_Data_Guide.md`

**Next.js Application (Future):**

- Database seed scripts
- Test user accounts
- Test event/race data

### Test Data Lifecycle

1. **Setup** - Create test data before tests
2. **Execution** - Use test data during tests
3. **Cleanup** - Remove test data after tests

### Isolation Strategies

**Database Transactions:**

- Use transactions that rollback
- Isolate each test
- Clean state for each test

**Test Containers:**

- Separate containers for tests
- Fresh database for each test run
- Isolated network

---

## Mocking External Services

### When to Mock

**Mock:**

- External APIs (LiveRC, third-party services)
- Email services
- Payment processors
- File storage services

**Don't Mock:**

- Database (use test database)
- Internal services (test integration)
- Core business logic (unit test)

### Mocking Strategies

**Python (pytest):**

```python
@pytest.fixture
def mock_http_client():
    """Mock HTTP client for external APIs"""
    with patch('ingestion.connectors.liverc.http_client') as mock:
        yield mock
```

**TypeScript (Future):**

```typescript
vi.mock("@/lib/ingestion-client", () => ({
  ingestionClient: {
    ingestEvent: vi.fn(),
  },
}))
```

---

## Database Testing Strategies

### Test Database Setup

**Approach:**

- Separate test database
- Migrations applied before tests
- Seed data loaded
- Transactions for isolation

### Database Test Patterns

**Setup:**

```typescript
// Future example
beforeAll(async () => {
  await setupTestDatabase()
  await runMigrations()
  await seedTestData()
})

afterAll(async () => {
  await cleanupTestDatabase()
})
```

**Isolation:**

```typescript
// Use transactions for isolation
beforeEach(async () => {
  await beginTransaction()
})

afterEach(async () => {
  await rollbackTransaction()
})
```

### Database Test Utilities

**Placeholder:** Database test utilities will be created

**Recommended Utilities:**

- Database setup/teardown
- Seed data helpers
- Query helpers
- Assertion helpers

---

## API Integration Testing

### Testing API Endpoints

**Scope:**

- Test API routes with real database
- Test authentication flows
- Test error handling
- Test data persistence

### API Test Pattern

**Future Example:**

```typescript
describe("POST /api/v1/auth/register", () => {
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
    const data = await response.json()
    expect(data.success).toBe(true)

    // Verify database
    const user = await findUserByEmail("test@example.com")
    expect(user).toBeDefined()
  })
})
```

### Authentication Testing

**Test Scenarios:**

- Successful registration
- Duplicate email handling
- Invalid input handling
- Successful login
- Invalid credentials
- Session management

---

## End-to-End Testing Approach

### E2E Test Scope

**Critical User Flows:**

- User registration → Login → Welcome page
- Track discovery → Event search → Event details
- Event ingestion → Race data → Lap times

### E2E Test Tools

**Placeholder:** E2E testing framework will be selected

**Recommended Tools:**

- Playwright - Cross-browser testing
- Cypress - Modern E2E testing
- Puppeteer - Chrome/Chromium automation

### E2E Test Pattern

**Future Example:**

```typescript
test("user can register and login", async ({ page }) => {
  // Register
  await page.goto("/register")
  await page.fill('[name="email"]', "test@example.com")
  await page.fill('[name="password"]', "password123")
  await page.fill('[name="driverName"]', "Test User")
  await page.click('button[type="submit"]')

  // Should redirect to welcome
  await expect(page).toHaveURL("/welcome")

  // Verify welcome message
  await expect(page.locator("h1")).toContainText("Welcome back Test User")
})
```

---

## CI/CD Integration Testing

### CI/CD Test Pipeline

**Placeholder:** CI/CD pipeline configuration will be documented

**Recommended Stages:**

1. **Lint** - Code quality
2. **Type Check** - TypeScript validation
3. **Unit Tests** - Fast unit tests
4. **Integration Tests** - Integration test suite
5. **E2E Tests** - End-to-end tests (optional, can run on schedule)

### Test Execution in CI

**Python Ingestion Service:**

```yaml
# Future CI configuration example
- name: Run integration tests
  run: |
    cd ingestion
    pytest tests/integration/ --cov=ingestion
```

**Next.js Application:**

```yaml
# Future CI configuration example
- name: Run integration tests
  run: |
    npm run test:integration
```

### Test Environment in CI

**Requirements:**

- Test database setup
- Test containers
- Test environment variables
- Test fixtures available

---

## Best Practices

### Test Organization

- Group related tests
- Use descriptive test names
- Keep tests focused
- Avoid test interdependencies

### Test Data

- Use realistic test data
- Keep test data minimal
- Clean up after tests
- Use factories for test data

### Test Performance

- Keep tests fast
- Use parallel execution
- Optimize database queries
- Mock slow operations

### Test Maintenance

- Update tests with code changes
- Remove obsolete tests
- Refactor test code
- Document test patterns

---

## Related Documentation

- [Testing Strategy](./testing-strategy.md) - Overall testing approach
- [Ingestion Testing Strategy](../architecture/liverc-ingestion/18-ingestion-testing-strategy.md) -
  Ingestion-specific testing
- [Telemetry Seed Data Guide](../telemetry/Design/Telemetry_Seed_Data_Guide.md) -
  Telemetry fixture creation and generator usage
- [Contributing Guidelines](./CONTRIBUTING.md) - Testing requirements

---

**End of Integration Testing Guide**
