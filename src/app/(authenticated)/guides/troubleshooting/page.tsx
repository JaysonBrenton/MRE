/**
 * @fileoverview Troubleshooting guide page
 *
 * @created 2026-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Troubleshooting guide for My Race Engineer users
 *
 * @purpose Provides solutions for common problems users may encounter, including
 *          login issues, event import failures, search problems, and performance issues.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - docs/user-guides/troubleshooting.md (markdown documentation)
 */

import Breadcrumbs from "@/components/Breadcrumbs"

export default async function TroubleshootingGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "Troubleshooting" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">Troubleshooting Guide</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Find solutions to common problems you may encounter while using My Race Engineer.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            This guide helps you resolve common problems and issues when using MRE. If you can&apos;t find
            a solution here, contact support for additional help.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Login Issues
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            If you can&apos;t log in, verify your credentials (check caps lock), ensure your account exists,
            and check if your account has been locked after too many failed attempts. Clear browser cache
            and cookies, try a different browser, or check your internet connection. If your session has
            expired, simply log in again.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Event Search Issues
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            If no events are found, verify your search criteria (track name, date range), try a different
            track or broader date range, and check if events exist on LiveRC. If search isn&apos;t working,
            refresh the page, clear browser cache, check your internet connection, or ensure all required
            fields are filled correctly.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Event Import Issues
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            If import failed, retry the import by selecting the failed event and clicking import again. Check
            that LiveRC is available and the event exists. If import is taking too long, wait longer (large
            events take time), refresh to check status, or retry if stuck for more than 10 minutes. If you
            see &quot;Import already in progress,&quot; wait for completion or contact support if stuck.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Event Analysis Issues
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            If charts aren&apos;t displaying, enable JavaScript, try a different browser, clear browser cache,
            or ensure the event is fully imported. If data is missing, check event status (should be
            &quot;Stored&quot;), re-import if needed, or check if filters are hiding data.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Performance Issues
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            If pages load slowly, check your internet connection speed, close unnecessary browser tabs, clear
            browser cache, or be patient with large events. If the application freezes, wait 30-60 seconds
            (may be processing), refresh the page, or restart your browser.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Navigation Issues
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            If you can&apos;t find features, check the User Guides section, browse the main navigation menu,
            or use breadcrumbs to understand your location. If the menu isn&apos;t visible, look for the
            hamburger icon, refresh the page, or check browser zoom level.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Data Issues
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            If events aren&apos;t matching, ensure your driver name matches race results, import events first,
            or wait for processing to complete. If data seems incorrect, verify source data on LiveRC, try
            re-importing the event, or contact support with details.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Getting Help
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Contact support if issues persist after trying solutions, you see error messages you don&apos;t
            understand, data seems incorrect, or features aren&apos;t working as expected. When contacting
            support, include a description of the problem, steps to reproduce, error messages, browser/device
            information, and screenshots if helpful.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related Guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            Learn the basics in the <a href="/guides/getting-started" className="text-[var(--token-accent)] hover:underline">Getting Started Guide</a>, understand event search in the <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">Event Search Guide</a>, or learn about analysis in the <a href="/guides/event-analysis" className="text-[var(--token-accent)] hover:underline">Event Analysis Guide</a>.
          </p>
        </section>
      </div>
    </section>
  )
}

