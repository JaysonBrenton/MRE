/**
 * @fileoverview Event Search (Find Events modal) guide page
 *
 * @relatedFiles
 * - docs/user-guides/event-search.md
 */

import Breadcrumbs from "@/components/atoms/Breadcrumbs"

export default async function EventSearchGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/eventAnalysis" },
          { label: "Guides", href: "/guides" },
          { label: "Event Search" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">Event Search Guide</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Find events by track, discover LiveRC races, import them, and open an event for My Event
          Analysis. Open the modal with{" "}
          <strong className="text-[var(--token-text-primary)]">⌘E</strong> or{" "}
          <strong className="text-[var(--token-text-primary)]">Actions → Find Events</strong>.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Omnibox (type-ahead)
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Type at least two characters to see database suggestions grouped as{" "}
            <strong className="text-[var(--token-text-primary)]">Tracks</strong> and{" "}
            <strong className="text-[var(--token-text-primary)]">Events</strong>. Suggestions never
            call LiveRC.
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>Pick a track to set your Filters track (search runs when you click Search).</li>
            <li>Pick an event to open it for analysis and close the modal.</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Filters popover
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Click <strong className="text-[var(--token-text-primary)]">Filters</strong>. Changes are
            staged until you click{" "}
            <strong className="text-[var(--token-text-primary)]">Apply</strong> (Apply does not run
            a search).
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Track</strong> — searchable modal
              with favourite stars
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Date filter</strong> — No filter,
              Last 3/6/12 months, This year, or Custom (last 7 years through today)
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Search LiveRC</strong> — merge
              LiveRC discovery with database results (requires a track)
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Include practice days</strong> —
              combined event + practice list (requires a track, when enabled)
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">
                Include Ready / Include Scheduled
              </strong>{" "}
              — hide imported or future events from the results table
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Running a search
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Cross-track browse:</strong>{" "}
              leave the omnibox empty, keep Search LiveRC and Include practice days off, click
              Search (lists database events across all tracks).
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Track search:</strong> pick a
              track, optionally set dates and toggles, Apply, then Search.
            </li>
            <li>
              Use <strong className="text-[var(--token-text-primary)]">Stop</strong> to cancel a
              search in progress.
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Results and actions
          </h2>
          <ul className="space-y-3 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Ready</strong> — imported with
              lap data · <strong className="text-[var(--token-text-primary)]">Open</strong>
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">New</strong> — LiveRC only ·{" "}
              <strong className="text-[var(--token-text-primary)]">Download</strong>
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Importing</strong> — wait for
              progress to finish
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Failed</strong> ·{" "}
              <strong className="text-[var(--token-text-primary)]">Retry import</strong>
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Scheduled</strong> — future
              event; import after the event date
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            <a href="/guides/global-search" className="text-[var(--token-accent)] hover:underline">
              Global Search
            </a>
            {" · "}
            <a href="/guides/dashboard" className="text-[var(--token-accent)] hover:underline">
              My Event Analysis
            </a>
            {" · "}
            <a href="/guides/event-analysis" className="text-[var(--token-accent)] hover:underline">
              Event Analysis
            </a>
          </p>
        </section>
      </div>
    </section>
  )
}
