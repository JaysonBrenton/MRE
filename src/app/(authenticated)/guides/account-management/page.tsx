/**
 * @fileoverview Account Management guide page
 *
 * @created 2026-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Account Management guide for My Race Engineer users
 *
 * @purpose Provides comprehensive instructions for account registration, login,
 *          password management, session management, and account security.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - docs/user-guides/account-management.md (markdown documentation)
 */

import Breadcrumbs from "@/components/atoms/Breadcrumbs"

export default async function AccountManagementGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "Account Management" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">
          Account Management Guide
        </h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Learn how to create and manage your My Race Engineer account, including registration,
          login, password management, and account security.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            This guide covers everything you need to know about managing your MRE account, from
            creating your first account to keeping it secure.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Creating Your Account
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            To create an account, navigate to the registration page and fill out the form with your
            email or username, password (minimum 8 characters), driver name (as it appears in race
            results), and optional team name. Click{" "}
            <strong className="text-[var(--token-text-primary)]">Create Account</strong> to complete
            registration. You&apos;ll be automatically logged in after registration.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Logging In
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Enter your email or username and password on the login page, then click{" "}
            <strong className="text-[var(--token-text-primary)]">Sign In</strong>. You can log in
            with either your email or username - both work the same way. If you have trouble logging
            in, verify your credentials, check that caps lock is off, and ensure your account
            hasn&apos;t been locked.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Logging Out
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Look for <strong className="text-[var(--token-text-primary)]">Log Out</strong> or{" "}
            <strong className="text-[var(--token-text-primary)]">Sign Out</strong> in the navigation
            menu (usually in account menu or user menu). Click to log out, and you&apos;ll be
            redirected to the login page. Save any unsaved work before logging out.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Password Management
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Create a strong password with a minimum of 8 characters, using a mix of letters,
            numbers, and symbols. Use a unique password (not used elsewhere) and consider using a
            password manager. Password change functionality will allow you to update your password
            directly from your account settings (coming soon). Contact support if you need to change
            your password now.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Session Management
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            A session keeps you logged in while you use MRE. Sessions remain active while you use
            the application and may expire after a period of inactivity. If you see &quot;Your
            session has expired. Please log in again,&quot; simply log in again to continue.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Account Security
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Follow security best practices: use a strong, unique password; don&apos;t share your
            password; only log in on trusted devices; log out on shared computers; and report
            suspicious activity. If you notice unexpected login notifications, changes you
            didn&apos;t make, or unfamiliar activity, change your password immediately and contact
            support.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Updating Account Information
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            You can usually update your driver name and team name in account settings. Your driver
            name is important for event matching - ensure it matches how your name appears in race
            results. Changes to your driver name affect future event matching. Contact support if
            you need to change your email or username.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related Guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            Learn first steps in the{" "}
            <a
              href="/guides/getting-started"
              className="text-[var(--token-accent)] hover:underline"
            >
              Getting Started Guide
            </a>
            , understand driver features in the{" "}
            <a
              href="/guides/driver-features"
              className="text-[var(--token-accent)] hover:underline"
            >
              Driver Features Guide
            </a>
            , or get help with issues in the{" "}
            <a
              href="/guides/troubleshooting"
              className="text-[var(--token-accent)] hover:underline"
            >
              Troubleshooting Guide
            </a>
            .
          </p>
        </section>
      </div>
    </section>
  )
}
