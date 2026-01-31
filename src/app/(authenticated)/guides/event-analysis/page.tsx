/**
 * @fileoverview Event Analysis guide page
 *
 * @created 2026-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Event Analysis guide for My Race Engineer users
 *
 * @purpose Provides comprehensive instructions for using the Event Analysis feature
 *          to view charts, compare drivers, explore sessions, and export data.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - docs/user-guides/event-analysis.md (markdown documentation)
 */

import Breadcrumbs from "@/components/atoms/Breadcrumbs"

export default async function EventAnalysisGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "Event Analysis" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">
          Event Analysis Guide
        </h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Learn how to analyze race event data, view interactive charts, compare drivers, and export
          data for further analysis.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            The Event Analysis page provides detailed insights into race events. You can view lap
            times, compare drivers, explore different sessions and heats, and export data for
            further analysis.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Accessing Event Analysis
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            After importing an event (status shows &quot;Stored&quot; or &quot;Imported&quot;),
            click the <strong className="text-[var(--token-text-primary)]">Analyse event</strong>{" "}
            button in the event row. You&apos;ll be taken to the Event Analysis page with tabs for
            Overview, Drivers, Sessions/Heats, and Comparisons.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Overview Tab
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            The Overview tab provides a quick &quot;at a glance&quot; summary with a main highlights
            chart showing best lap per driver or average lap vs fastest lap. Use checkboxes to
            select/unselect drivers and switch between metrics like lap time and gap to leader.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Drivers Tab
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            View all drivers who participated in the event. See driver name, number of races, best
            lap time, average lap time, and consistency score. Select multiple drivers using
            checkboxes to compare them in the Comparisons tab.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Sessions / Heats Tab
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Explore all races and sessions organized by class and session type. Filter by class or
            session type (Mains, Qualifying, Heats). Click on a session to see complete race results
            with position, driver, laps, total time, fast lap, and average lap.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Comparisons Tab
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Compare selected drivers side-by-side with interactive charts:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Lap Time Comparison:</strong>{" "}
              Overlay multiple drivers&apos; lap times on the same graph
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Position Over Time:</strong> Show
              position changes for selected drivers
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Gap Analysis:</strong> Show time
              gap to leader for selected drivers
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Exporting Data
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Export data to CSV format using export buttons in the page header, per-tab, or within
            chart controls. Export includes only visible/filtered data, respecting your current
            filters and selections. File naming:{" "}
            <code className="text-[var(--token-text-primary)]">{`{event-name}_{data-type}_{timestamp}.csv`}</code>
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Tips for Effective Analysis
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              Compare your performance against the fastest driver to identify where you&apos;re
              losing time
            </li>
            <li>Use lap time graphs to identify slow laps and consistency issues</li>
            <li>Filter by class or session type to focus on specific races</li>
            <li>Export data for further analysis in spreadsheet applications</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related Guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            Learn how to find events in the{" "}
            <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">
              Event Search Guide
            </a>
            , or explore the{" "}
            <a href="/guides/dashboard" className="text-[var(--token-accent)] hover:underline">
              My Event Analysis Guide
            </a>{" "}
            to track your progress over time.
          </p>
        </section>
      </div>
    </section>
  )
}
