/**
 * @fileoverview Driver Features guide page
 *
 * @created 2026-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Driver Features guide for My Race Engineer users
 *
 * @purpose Provides comprehensive instructions for viewing discovered events,
 *          understanding fuzzy matching, confirming participation, and managing driver information.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - docs/user-guides/driver-features.md (markdown documentation)
 */

import Breadcrumbs from "@/components/Breadcrumbs"

export default async function DriverFeaturesGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "Driver Features" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">Driver Features Guide</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Learn how MRE automatically discovers events where you participated, understand match types,
          confirm your participation, and manage your driver information.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            MRE uses intelligent matching to automatically discover events where you participated. This
            guide explains how the discovery process works, how to view discovered events, and how to
            confirm or reject participation suggestions.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            How Event Discovery Works
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            When events are imported into MRE, the system automatically extracts driver names, normalizes them, and matches them against all user driver names. MRE uses three matching methods in priority order:
          </p>
          <ol className="list-decimal space-y-3 pl-6 text-[var(--token-text-secondary)]">
            <li><strong className="text-[var(--token-text-primary)]">Transponder Match</strong> (Highest Priority): Matches your transponder number - very accurate, automatically confirmed</li>
            <li><strong className="text-[var(--token-text-primary)]">Exact Name Match</strong> (Second Priority): Matches your driver name exactly - high accuracy, automatically confirmed</li>
            <li><strong className="text-[var(--token-text-primary)]">Fuzzy Name Match</strong> (Third Priority): Finds similar driver names - medium accuracy, requires your confirmation</li>
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Viewing Discovered Events
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Access discovered events from your Dashboard or My Events page. Events show status indicators:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li><strong className="text-[var(--token-text-primary)]">Confirmed</strong> (Green): You&apos;ve confirmed participation OR system matched via transponder/exact name</li>
            <li><strong className="text-[var(--token-text-primary)]">Suggested</strong> (Blue): System suggests you participated (fuzzy match) - requires your review</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Confirming Participation
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            For suggested events, review the event details including event name, date, track location, and the driver name in the event. If you participated, click <strong className="text-[var(--token-text-primary)]">Confirm Participation</strong> to link the event to your profile. If you did not participate, click <strong className="text-[var(--token-text-primary)]">Reject</strong> to remove it from your discovered events.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Managing Your Driver Information
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            View and update your driver profile in account settings. Your driver name is important for event matching - ensure it matches how your name appears in race results. Registering your transponder number provides the most accurate matching and automatic confirmation of matches.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Tips and Best Practices
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>Use your exact racing name as it appears in race results</li>
            <li>Register your transponder for the most accurate matching</li>
            <li>Review suggestions promptly to help the system learn</li>
            <li>Keep your driver name consistent - don&apos;t change it frequently</li>
            <li>Reject incorrect matches to prevent false associations</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related Guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            Learn how to manually search for events in the <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">Event Search Guide</a>, analyze events in the <a href="/guides/event-analysis" className="text-[var(--token-accent)] hover:underline">Event Analysis Guide</a>, or manage your account in the <a href="/guides/account-management" className="text-[var(--token-accent)] hover:underline">Account Management Guide</a>.
          </p>
        </section>
      </div>
    </section>
  )
}

