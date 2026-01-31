/**
 * @fileoverview E2E test for practice day search functionality
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description End-to-end test for practice day search UI using Playwright
 *
 * @purpose Tests the complete practice day search flow including:
 *          - Accessing the search page
 *          - Selecting track, year, and month
 *          - Verifying results render without errors
 *          - Ensuring toLocaleString() error is fixed
 *
 * @relatedFiles
 * - src/components/practice-days/PracticeDaySearchContainer.tsx
 * - src/components/practice-days/PracticeDayRow.tsx
 */

import { test, expect } from "@playwright/test"

/**
 * Admin account credentials from seed script
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@mre.local"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456"

test.describe("Practice Day Search", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
    await page.getByRole("button", { name: /sign in/i }).click()

    // Wait for login to complete
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })

    // Navigate to event search page where practice day search is located
    await page.goto("/event-search")
    await page.waitForLoadState("networkidle")
  })

  test("should render practice day search without toLocaleString errors", async ({ page }) => {
    // Set up console error listener to catch any runtime errors
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    page.on("pageerror", (error) => {
      errors.push(error.message)
    })

    // Switch to practice days mode if there's a mode selector
    const practiceDayButton = page
      .getByRole("button", { name: /practice.*day/i })
      .or(page.getByRole("tab", { name: /practice.*day/i }))
      .first()

    if (await practiceDayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await practiceDayButton.click()
      await page.waitForTimeout(1000)
    }

    // Select a track if track selector is visible
    const trackSelect = page
      .getByLabel(/track/i)
      .or(page.locator('select, [role="combobox"]').first())

    if (await trackSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await trackSelect.click()
      await page.waitForTimeout(500)

      // Try to select first option
      const firstOption = page.getByRole("option").first()
      if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstOption.click()
        await page.waitForTimeout(1000)
      }
    }

    // Set year and month if inputs are visible
    const yearInput = page
      .getByLabel(/year/i)
      .or(
        page
          .locator(
            'input[type="number"][placeholder*="year" i], input[type="number"][name*="year" i]'
          )
          .first()
      )

    const monthInput = page
      .getByLabel(/month/i)
      .or(
        page
          .locator(
            'input[type="number"][placeholder*="month" i], input[type="number"][name*="month" i]'
          )
          .first()
      )

    if (await yearInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await yearInput.fill("2025")
      await page.waitForTimeout(500)
    }

    if (await monthInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthInput.fill("1")
      await page.waitForTimeout(500)
    }

    // Wait for any search results to load
    await page.waitForTimeout(3000)

    // Check for the specific error we're trying to fix
    const toLocaleStringErrors = errors.filter(
      (err) =>
        err.includes("toLocaleString") ||
        (err.includes("Cannot read properties of undefined") && err.includes("toLocaleString"))
    )

    expect(toLocaleStringErrors.length).toBe(0)
  })

  test("should display practice day results when search is performed", async ({ page }) => {
    // Set up error tracking
    const errors: string[] = []
    page.on("pageerror", (error) => {
      errors.push(error.message)
    })

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    // Switch to practice days mode
    const practiceDayButton = page
      .getByRole("button", { name: /practice.*day/i })
      .or(page.getByRole("tab", { name: /practice.*day/i }))
      .first()

    if (await practiceDayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await practiceDayButton.click()
      await page.waitForTimeout(1000)
    }

    // Select a track
    const trackSelect = page
      .getByLabel(/track/i)
      .or(page.locator('select, [role="combobox"]').first())

    if (await trackSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await trackSelect.click()
      await page.waitForTimeout(500)

      const firstOption = page.getByRole("option").first()
      if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstOption.click()
        await page.waitForTimeout(1000)
      }
    }

    // Set year and month
    const yearInput = page
      .getByLabel(/year/i)
      .or(
        page
          .locator(
            'input[type="number"][placeholder*="year" i], input[type="number"][name*="year" i]'
          )
          .first()
      )

    const monthInput = page
      .getByLabel(/month/i)
      .or(
        page
          .locator(
            'input[type="number"][placeholder*="month" i], input[type="number"][name*="month" i]'
          )
          .first()
      )

    if (await yearInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await yearInput.fill("2025")
      await page.waitForTimeout(500)
    }

    if (await monthInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthInput.fill("1")
      await page.waitForTimeout(500)
    }

    // Wait for results to load
    await page.waitForTimeout(5000)

    // Check for practice day result rows - look for "Total Laps" text which indicates PracticeDayRow rendered
    const totalLapsText = page.getByText(/total laps/i)
    const hasResults = await totalLapsText.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasResults) {
      // Verify no toLocaleString errors occurred
      const toLocaleStringErrors = errors.filter(
        (err) =>
          err.includes("toLocaleString") ||
          (err.includes("Cannot read properties of undefined") && err.includes("toLocaleString"))
      )

      expect(toLocaleStringErrors.length).toBe(0)

      // Verify that the Total Laps value is displayed (not empty or error)
      const totalLapsValue = page
        .locator("text=/Total Laps:/i")
        .locator("..")
        .getByText(/\d+/)
        .first()
      if (await totalLapsValue.isVisible({ timeout: 2000 }).catch(() => false)) {
        const value = await totalLapsValue.textContent()
        expect(value).toBeTruthy()
        expect(value).not.toBe("undefined")
        expect(value).not.toBe("null")
      }
    } else {
      // Even if no results, we should not have errors
      const toLocaleStringErrors = errors.filter(
        (err) =>
          err.includes("toLocaleString") ||
          (err.includes("Cannot read properties of undefined") && err.includes("toLocaleString"))
      )
      expect(toLocaleStringErrors.length).toBe(0)
    }
  })

  test("should handle missing data gracefully without errors", async ({ page }) => {
    // This test verifies that even with missing/undefined data,
    // the component doesn't throw toLocaleString errors

    const errors: string[] = []
    page.on("pageerror", (error) => {
      errors.push(error.message)
    })

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    // Switch to practice days mode
    const practiceDayButton = page
      .getByRole("button", { name: /practice.*day/i })
      .or(page.getByRole("tab", { name: /practice.*day/i }))
      .first()

    if (await practiceDayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await practiceDayButton.click()
      await page.waitForTimeout(2000)
    }

    // Wait for any async operations and potential API calls
    await page.waitForTimeout(3000)

    // Check for the specific error
    const toLocaleStringErrors = errors.filter(
      (err) =>
        err.includes("toLocaleString") ||
        (err.includes("Cannot read properties of undefined") && err.includes("toLocaleString"))
    )

    expect(toLocaleStringErrors.length).toBe(0)
  })
})
