/**
 * @fileoverview E2E test for driver names in sessions table
 *
 * @created 2025-01-XX
 * @creator System
 * @lastModified 2025-01-XX
 *
 * @description End-to-end test to verify driver names appear in the expanded sessions table
 *
 * @purpose Tests that when a session row is expanded, driver names are displayed in the Driver column
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTableResults.tsx
 * - src/components/event-analysis/sessions/SessionsTableRow.tsx
 * - src/core/events/get-sessions-data.ts
 */

import { test, expect } from "@playwright/test"

/**
 * Admin account credentials from seed script
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@mre.local"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456"

test.describe("Sessions Table Driver Names", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login")
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
    await page.getByRole("button", { name: /sign in/i }).click()

    // Wait for login to complete
    await page.waitForURL(/\/admin|\/dashboard/, { timeout: 10000 })
  })

  test("should display driver names in expanded sessions table", async ({ page }) => {
    // Navigate to event search to find an event
    await page.goto("/event-search")
    await page.waitForLoadState("networkidle")

    // Wait for events table to load
    const eventsTable = page.locator("table").first()
    const hasTable = (await eventsTable.count()) > 0

    if (!hasTable) {
      test.skip()
      return
    }

    // Find first event row and click it
    const eventRows = page.locator("tbody tr")
    const hasEvents = (await eventRows.count()) > 0

    if (!hasEvents) {
      test.skip()
      return
    }

    // Click on first event to navigate to analysis page
    await eventRows.first().click()

    // Wait for navigation to event analysis page
    await expect(page).toHaveURL(/\/events\/analyse\/[a-f0-9-]+/, { timeout: 10000 })
    await page.waitForLoadState("networkidle")

    // Navigate to Sessions tab
    const sessionsTab = page.getByRole("tab", { name: /sessions|heats/i })
    if ((await sessionsTab.count()) === 0) {
      test.skip()
      return
    }
    await sessionsTab.click()

    // Wait for sessions content to load
    await page.waitForLoadState("networkidle")

    // Check console logs for debugging
    page.on("console", (msg) => {
      if (msg.text().includes("SessionsTableResults") || msg.text().includes("getSessionsData")) {
        console.log("BROWSER CONSOLE:", msg.text())
      }
    })

    // First, select a class if needed - go to Overview tab first
    const overviewTab = page.getByRole("tab", { name: /overview/i })
    if ((await overviewTab.count()) > 0) {
      await overviewTab.click()
      await page.waitForLoadState("networkidle")

      // Look for class filter dropdown
      const classSelect = page.locator("select").first()
      if ((await classSelect.count()) > 0) {
        const options = await classSelect.locator("option").all()
        if (options.length > 1) {
          const firstOption = options[1]
          const optionValue = await firstOption.getAttribute("value")
          if (optionValue && optionValue.trim() !== "") {
            await classSelect.selectOption(optionValue)
            await page.waitForLoadState("networkidle")
          }
        }
      }

      // Go back to Sessions tab
      await sessionsTab.click()
      await page.waitForLoadState("networkidle")
    }

    // Find the sessions table
    const sessionsTable = page
      .locator("table")
      .filter({ hasText: /session name|race overview/i })
      .first()
    const hasSessionsTable = (await sessionsTable.count()) > 0

    if (!hasSessionsTable) {
      test.skip()
      return
    }

    await sessionsTable.waitFor({ state: "visible", timeout: 10000 })

    // Find first expandable session row (has expand arrow)
    const expandableRows = sessionsTable.locator("tbody tr").filter({
      has: page.locator("span").filter({ hasText: /▶/ }),
    })

    const rowCount = await expandableRows.count()
    if (rowCount === 0) {
      test.skip()
      return
    }

    const firstRow = expandableRows.first()

    // Click to expand the row
    await firstRow.click()

    // Wait for expanded content to appear
    await page.waitForTimeout(1000) // Wait for expansion

    // Find the expanded results table - look for table with Driver header
    const expandedTable = page
      .locator("table")
      .filter({
        has: page.getByRole("columnheader", { name: /driver/i }),
      })
      .last()

    const hasExpandedTable = (await expandedTable.count()) > 0
    if (!hasExpandedTable) {
      // Take screenshot for debugging
      await page.screenshot({ path: "test-results/sessions-table-expanded.png", fullPage: true })
      throw new Error("Expanded table with Driver header not found")
    }

    await expandedTable.waitFor({ state: "visible", timeout: 5000 })

    // Verify Driver column header exists
    const driverHeader = expandedTable.getByRole("columnheader", { name: /driver/i })
    await expect(driverHeader).toBeVisible()

    // Get all data rows in the expanded table
    const dataRows = expandedTable.locator("tbody tr")
    const dataRowCount = await dataRows.count()

    expect(dataRowCount).toBeGreaterThan(0)

    // Check each row to verify driver names are displayed
    const driverNames: string[] = []
    for (let i = 0; i < dataRowCount; i++) {
      const row = dataRows.nth(i)

      // Get the Driver column (second column after Position)
      const driverCell = row.locator("td").nth(1)

      // Verify the cell is visible
      await expect(driverCell).toBeVisible()

      // Get the text content
      const driverNameText = await driverCell.textContent()
      const trimmed = driverNameText?.trim() || ""

      driverNames.push(trimmed)

      // Verify driver name is not empty
      expect(trimmed.length).toBeGreaterThan(0)
    }

    // Log all driver names found
    console.log("Driver names found in table:", driverNames)

    // Verify at least one row has a non-empty, non-dash driver name
    const validDriverNames = driverNames.filter(
      (name) => name.length > 0 && name !== "—" && name !== "Unknown Driver"
    )

    if (validDriverNames.length === 0) {
      // Take screenshot for debugging
      await page.screenshot({
        path: "test-results/sessions-table-no-driver-names.png",
        fullPage: true,
      })
      throw new Error(`No valid driver names found. Found: ${JSON.stringify(driverNames)}`)
    }

    expect(validDriverNames.length).toBeGreaterThan(0)
  })
})
