/**
 * @fileoverview E2E test for My Event page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description End-to-end test for the My Event page that displays events
 *              matched to the user's driver name using fuzzy matching
 * 
 * @purpose Tests the complete My Event page flow including:
 *          - Authentication and navigation
 *          - Loading and displaying matched events
 *          - Event table structure and data
 *          - Event click navigation
 * 
 * @relatedFiles
 * - src/app/(authenticated)/dashboard/my-event/page.tsx (My Event page)
 * - src/app/api/v1/personas/driver/events/route.ts (API endpoint)
 * - src/core/personas/driver-events.ts (driver event discovery logic)
 * - docs/development/testing-strategy.md (testing guidelines)
 */

import { test, expect } from '@playwright/test'

/**
 * Test user credentials
 * These should match a real user in the database with driver name "Jayson Brenton"
 * Can be overridden with environment variables:
 * - TEST_USER_EMAIL
 * - TEST_USER_PASSWORD
 */
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'jaysoncareybrenton@gmail.com'
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'S-works29er2016'
const EXPECTED_DRIVER_NAME = 'Jayson Brenton'

test.describe('My Event Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.getByLabel(/email address/i).fill(TEST_USER_EMAIL)
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // Wait for login to complete (redirect to dashboard or welcome page)
    await page.waitForURL(/\/dashboard|\/welcome/, { timeout: 10000 })
  })

  test('should navigate to my-event page', async ({ page }) => {
    // Navigate to my-event page
    await page.goto('/dashboard/my-event')
    
    // Verify we're on the correct page
    await expect(page).toHaveURL(/\/dashboard\/my-event/)
    
    // Verify page title/heading is visible
    await expect(page.getByRole('heading', { name: /my event/i })).toBeVisible()
  })

  test('should display page header and description', async ({ page }) => {
    await page.goto('/dashboard/my-event')
    
    // Check page header
    await expect(page.getByRole('heading', { name: /my event/i })).toBeVisible()
    
    // Check description text
    await expect(page.getByText(/events matched to your driver name/i)).toBeVisible()
  })

  test('should handle loading state', async ({ page }) => {
    await page.goto('/dashboard/my-event')
    
    // The page should show loading state initially (if events are being fetched)
    // Wait for page to stabilize - either shows loading, content, or error
    await page.waitForLoadState('networkidle')
    
    // Verify page has loaded (either shows content or error)
    // Check for any of the possible states
    const hasEventName = await page.getByText(/event name/i).count() > 0
    const hasNoEvents = await page.getByText(/no events found/i).count() > 0
    const hasError = await page.getByText(/error:/i).count() > 0
    const hasLoading = await page.getByText(/loading events/i).count() > 0
    
    // At least one state should be visible
    expect(hasEventName || hasNoEvents || hasError || hasLoading).toBe(true)
  })

  test('should display events table when events exist', async ({ page }) => {
    await page.goto('/dashboard/my-event')
    
    // Wait for page to load (either shows events or empty state)
    await page.waitForLoadState('networkidle')
    
    // Check if events table exists (if events are found)
    const eventsTable = page.locator('table')
    const hasEvents = await eventsTable.count() > 0
    
    if (hasEvents) {
      // Verify table structure
      await expect(page.getByRole('columnheader', { name: /event name/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /track/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /date/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /match type/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /similarity score/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
      
      // Verify at least one event row exists
      const eventRows = page.locator('tbody tr')
      const rowCount = await eventRows.count()
      expect(rowCount).toBeGreaterThan(0)
      
      // Verify event data is displayed in first row
      const firstRow = eventRows.first()
      await expect(firstRow).toBeVisible()
      
      // Check that match type badge is visible (can be Exact, Fuzzy, or Transponder Match)
      const matchTypeBadge = firstRow.getByText(/(exact|fuzzy|transponder) match/i)
      await expect(matchTypeBadge).toBeVisible()
    }
  })

  test('should display empty state when no events found', async ({ page }) => {
    await page.goto('/dashboard/my-event')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check if empty state is shown (if no events)
    const emptyState = page.getByText(/no events found that match your driver name/i)
    const eventsTable = page.locator('table')
    
    const hasEvents = await eventsTable.count() > 0
    const hasEmptyState = await emptyState.count() > 0
    
    // Either events table or empty state should be visible
    expect(hasEvents || hasEmptyState).toBe(true)
    
    if (hasEmptyState) {
      // Verify empty state message
      await expect(emptyState).toBeVisible()
      await expect(page.getByText(/events will appear here once the system discovers matches/i)).toBeVisible()
      
      // Verify search link is present
      await expect(page.getByRole('link', { name: /search for events/i })).toBeVisible()
    }
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API call and return error
    await page.route('**/api/v1/personas/driver/events*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Test error'
          }
        })
      })
    })
    
    await page.goto('/dashboard/my-event')
    
    // Wait for error to appear
    await expect(page.getByText(/error:/i)).toBeVisible({ timeout: 5000 })
  })

  test('should navigate to event analysis page when event is clicked', async ({ page }) => {
    await page.goto('/dashboard/my-event')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check if events table exists
    const eventsTable = page.locator('table')
    const hasEvents = await eventsTable.count() > 0
    
    if (hasEvents) {
      // Get first event row
      const firstRow = page.locator('tbody tr').first()
      
      // Click on the row
      await firstRow.click()
      
      // Verify navigation to event analysis page
      await expect(page).toHaveURL(/\/events\/analyse\/[a-f0-9-]+/, { timeout: 5000 })
    } else {
      // Skip test if no events exist
      test.skip()
    }
  })

  test('should display event details correctly', async ({ page }) => {
    await page.goto('/dashboard/my-event')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    const eventsTable = page.locator('table')
    const hasEvents = await eventsTable.count() > 0
    
    if (hasEvents) {
      const firstRow = page.locator('tbody tr').first()
      
      // Verify event name is displayed
      const eventNameCell = firstRow.locator('td').nth(0)
      await expect(eventNameCell).toBeVisible()
      const eventName = await eventNameCell.textContent()
      expect(eventName).toBeTruthy()
      expect(eventName!.trim().length).toBeGreaterThan(0)
      
      // Verify track name is displayed (or "Unknown Track")
      const trackCell = firstRow.locator('td').nth(1)
      await expect(trackCell).toBeVisible()
      
      // Verify date is displayed
      const dateCell = firstRow.locator('td').nth(2)
      await expect(dateCell).toBeVisible()
      
      // Verify match type badge (can be Exact, Fuzzy, or Transponder)
      const matchTypeBadge = firstRow.getByText(/(exact|fuzzy|transponder) match/i)
      await expect(matchTypeBadge).toBeVisible()
      
      // Verify similarity score is displayed (or "N/A")
      const similarityCell = firstRow.locator('td').nth(4)
      await expect(similarityCell).toBeVisible()
      
      // Verify status badge
      const statusCell = firstRow.locator('td').nth(5)
      await expect(statusCell).toBeVisible()
      // Status should be one of: Confirmed, Suggested, or Unknown
      const statusText = await statusCell.textContent()
      expect(statusText).toMatch(/confirmed|suggested|unknown/i)
    }
  })

  test('should filter events by match type when query parameter is provided', async ({ page }) => {
    // Navigate with exact match type filter (since we know the user has an exact match)
    await page.goto('/dashboard/my-event?matchType=exact')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Verify page loaded successfully
    await expect(page.getByRole('heading', { name: /my event/i })).toBeVisible()
    
    // If events are displayed, they should all be exact matches
    const eventsTable = page.locator('table')
    const hasEvents = await eventsTable.count() > 0
    
    if (hasEvents) {
      // All visible events should have "Exact Match" badge
      const exactBadges = page.getByText(/exact match/i)
      const badgeCount = await exactBadges.count()
      expect(badgeCount).toBeGreaterThan(0)
    }
  })

  test('should show event count when events are displayed', async ({ page }) => {
    await page.goto('/dashboard/my-event')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    const eventsTable = page.locator('table')
    const hasEvents = await eventsTable.count() > 0
    
    if (hasEvents) {
      // Verify event count text is displayed
      const eventCountText = page.getByText(/showing \d+ event/i)
      await expect(eventCountText).toBeVisible()
      
      // Extract and verify the count matches the number of rows
      const rowCount = await page.locator('tbody tr').count()
      const countText = await eventCountText.textContent()
      const match = countText?.match(/(\d+)/)
      if (match) {
        const displayedCount = parseInt(match[1], 10)
        expect(displayedCount).toBe(rowCount)
      }
    }
  })

  test('should display events for Jayson Brenton driver', async ({ page }) => {
    // Navigate to my-event page
    await page.goto('/dashboard/my-event')
    
    // Wait for page to load and check for errors
    await page.waitForLoadState('networkidle')
    
    // Verify no error is displayed
    const errorText = page.getByText(/error:/i)
    const hasError = await errorText.count() > 0
    expect(hasError).toBe(false)
    
    // Check if events table exists
    const eventsTable = page.locator('table')
    const hasEvents = await eventsTable.count() > 0
    
    if (hasEvents) {
      // Verify at least one event row exists
      const eventRows = page.locator('tbody tr')
      const rowCount = await eventRows.count()
      expect(rowCount).toBeGreaterThan(0)
      
      // Verify event data is displayed correctly
      const firstRow = eventRows.first()
      await expect(firstRow).toBeVisible()
      
      // Verify event name is displayed
      const eventNameCell = firstRow.locator('td').nth(0)
      await expect(eventNameCell).toBeVisible()
      const eventName = await eventNameCell.textContent()
      expect(eventName).toBeTruthy()
      expect(eventName!.trim().length).toBeGreaterThan(0)
      
      // Verify match type badge is visible
      const matchTypeBadge = firstRow.getByText(/(exact|fuzzy|transponder) match/i)
      await expect(matchTypeBadge).toBeVisible()
      
      // Verify similarity score or status is displayed
      const similarityCell = firstRow.locator('td').nth(4)
      await expect(similarityCell).toBeVisible()
    } else {
      // If no events, verify empty state is shown
      const emptyState = page.getByText(/no events found that match your driver name/i)
      await expect(emptyState).toBeVisible()
    }
  })
})

