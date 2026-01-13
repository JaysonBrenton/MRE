/**
 * @fileoverview Event Search guide page
 *
 * @created 2026-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Event Search guide for My Race Engineer users
 *
 * @purpose Provides comprehensive instructions for using the Event Search feature
 *          to find, discover, and import race events from LiveRC.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - docs/user-guides/event-search.md (markdown documentation)
 */

import Breadcrumbs from "@/components/Breadcrumbs"

export default async function EventSearchGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "Event Search" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">Event Search Guide</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Learn how to search for race events, select tracks, import events from LiveRC, and
          understand event status indicators.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            The Event Search feature allows you to discover and import race events from LiveRC. You
            can search for events by track and date range, then import them into MRE for detailed
            analysis.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Accessing Event Search
          </h2>
          <ol className="list-decimal space-y-3 pl-6 text-[var(--token-text-secondary)]">
            <li>Log into your MRE account</li>
            <li>Navigate to <strong className="text-[var(--token-text-primary)]">Event Search</strong> from the main navigation menu</li>
            <li>You&apos;ll see the Event Search form with track selection and date range fields</li>
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Selecting a Track
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Click on the <strong className="text-[var(--token-text-primary)]">Track</strong> field to open the track selection modal. The modal displays a searchable list of all available tracks (approximately 1,100 tracks). Use the search box at the top to filter tracks by name.
          </p>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            <strong className="text-[var(--token-text-primary)]">Favourite Tracks:</strong> Click the star icon (⭐) next to any track to add it to your favourites. Favourite tracks appear at the top of the modal and as quick-select chips above the Event Search form.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Setting Date Ranges
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Select your <strong className="text-[var(--token-text-primary)]">Start Date</strong> and <strong className="text-[var(--token-text-primary)]">End Date</strong> using the date pickers. Important rules:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>Date ranges cannot exceed <strong className="text-[var(--token-text-primary)]">3 months</strong> (90 days)</li>
            <li>You cannot select <strong className="text-[var(--token-text-primary)]">future dates</strong></li>
            <li>The start date must be before or equal to the end date</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Performing a Search
          </h2>
          <ol className="list-decimal space-y-3 pl-6 text-[var(--token-text-secondary)]">
            <li>Select a track from the track selection modal</li>
            <li>Set your date range (start and end dates)</li>
            <li>Click the <strong className="text-[var(--token-text-primary)]">Search</strong> button</li>
            <li>MRE first searches its database, then automatically queries LiveRC if no events are found</li>
            <li>Events are displayed in the results table below the search form</li>
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Understanding Event Status Indicators
          </h2>
          <ul className="space-y-3 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Stored / Imported</strong> (Green): Event exists in MRE database with full data. Click &quot;Analyse event&quot; to view detailed analysis.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">New (LiveRC only)</strong> (Blue): Discovered on LiveRC, not yet imported. Select the checkbox to import the event.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Importing</strong> (Yellow): Currently being imported. Wait for import to complete.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Failed import</strong> (Red): Last import attempt failed. You can retry the import.
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Importing Events
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            To import events, select one or more events with status &quot;New (LiveRC only)&quot; by checking their checkboxes, then click <strong className="text-[var(--token-text-primary)]">Import X selected events</strong>. Events are imported sequentially, and you can watch the progress indicator.
          </p>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Once an event is successfully imported, its status changes to &quot;Stored&quot; and the &quot;Analyse event&quot; button becomes available.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Tips and Best Practices
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>Use favourites to quickly access frequently searched tracks</li>
            <li>Start with a 30-day date range, then narrow if needed</li>
            <li>Pay attention to event status indicators to understand what actions are available</li>
            <li>Import multiple events at once to save time</li>
            <li>Your last search is automatically saved for convenience</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related Guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            After importing events, check out the <a href="/guides/event-analysis" className="text-[var(--token-accent)] hover:underline">Event Analysis Guide</a> to learn how to analyze your race data, or the <a href="/guides/navigation" className="text-[var(--token-accent)] hover:underline">Navigation Guide</a> to master navigation patterns.
          </p>
        </section>
      </div>
    </section>
  )
}

