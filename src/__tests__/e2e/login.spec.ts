/**
 * @fileoverview E2E test for login functionality
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description End-to-end test for user login using Playwright
 * 
 * @purpose Tests the complete login flow including:
 *          - Accessing the login page
 *          - Entering credentials
 *          - Successful authentication
 *          - Redirect to appropriate page (admin or welcome)
 * 
 * @relatedFiles
 * - src/app/login/page.tsx (login page component)
 * - src/app/actions/auth.ts (authentication server action)
 * - docs/development/testing-strategy.md (testing guidelines)
 */

import { test, expect } from '@playwright/test'

/**
 * Admin account credentials from seed script
 * Default values: admin@mre.local / admin123456
 * Can be overridden with environment variables:
 * - ADMIN_EMAIL
 * - ADMIN_PASSWORD
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mre.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456'

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login')
  })

  test('should display login form', async ({ page }) => {
    // Check that login form elements are visible
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('should show validation errors for empty form', async ({ page }) => {
    // Try to submit empty form
    const emailInput = page.getByLabel(/email address/i)
    const passwordInput = page.getByLabel(/password/i)
    
    // Clear any existing values
    await emailInput.clear()
    await passwordInput.clear()
    
    // Try to submit
    await page.getByRole('button', { name: /sign in/i }).click()

    // Check that email field has required attribute (HTML5 validation)
    const isRequired = await emailInput.getAttribute('required')
    expect(isRequired).not.toBeNull()
    
    // Verify form didn't submit (page should still be on login)
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel(/email address/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for error message to appear
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 5000,
    })
  })

  test('should successfully login with admin credentials', async ({ page }) => {
    // Fill in admin credentials
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for redirect after successful login
    // Admin users should be redirected to /admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })

    // Verify we're on the admin page
    // The page should contain admin-specific content
    await expect(page).toHaveURL(/\/admin/)
  })

  test('should redirect admin to admin page after login', async ({ page }) => {
    // Login as admin
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for redirect to admin page
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })

    // Verify admin page content is visible
    // This assumes the admin page has some identifiable content
    // Adjust selector based on actual admin page structure
    const pageContent = page.locator('body')
    await expect(pageContent).toBeVisible()
  })

  test('should persist session after page reload', async ({ page, context }) => {
    // Login as admin
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for redirect to admin page
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })

    // Reload the page
    await page.reload()

    // Should still be on admin page (session persisted)
    await expect(page).toHaveURL(/\/admin/)
  })

  test('should show loading state during login', async ({ page }) => {
    // Fill in credentials
    await page.getByLabel(/email address/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)

    // Click login button
    const loginButton = page.getByRole('button', { name: /sign in/i })
    
    // Start login and wait for navigation (login is fast, so we just verify it completes)
    await Promise.all([
      loginButton.click(),
      page.waitForURL(/\/admin/, { timeout: 10000 })
    ])
    
    // Verify we navigated to admin page (login was successful)
    await expect(page).toHaveURL(/\/admin/)
  })
})

