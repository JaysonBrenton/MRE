/**
 * @fileoverview Global Search guide page
 *
 * @relatedFiles
 * - docs/user-guides/global-search.md
 */

import Breadcrumbs from "@/components/atoms/Breadcrumbs"

export default async function GlobalSearchGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/eventAnalysis" },
          { label: "Guides", href: "/guides" },
          { label: "Global Search" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">Global Search Guide</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Use <strong className="text-[var(--token-text-primary)]">/search</strong> to query
          ingested events and sessions with keyword, driver, session-type, and date filters.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            How this differs from Event Search
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            <strong className="text-[var(--token-text-primary)]">Global Search</strong> is a
            standalone page for cross-corpus keyword lookup. The dashboard{" "}
            <strong className="text-[var(--token-text-primary)]">Event Search</strong> modal (Find
            Events / ⌘E) is for track-scoped discovery, LiveRC import, and picking an event for
            analysis. See the{" "}
            <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">
              Event Search guide
            </a>
            .
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Form controls
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Search</strong> — free text
              across event and session names
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Driver Name</strong> — optional
              filter
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Session Type</strong> — race,
              heat, main, seeding, practice, qualifying, or all
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Start / End dates</strong> —
              optional inclusive window
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">Results</h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Results split into <strong className="text-[var(--token-text-primary)]">Events</strong>{" "}
            and <strong className="text-[var(--token-text-primary)]">Sessions</strong> tables. Click{" "}
            <strong className="text-[var(--token-text-primary)]">View Event</strong> to open My
            Event Analysis for that event. Pagination supports 10, 25, 50, or 100 rows per page.
          </p>
          <p className="text-[var(--token-text-secondary)]">
            Searching does not import new LiveRC data. Use Event Search or Actions → Find and Import
            Events to ingest events.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">
              Event Search
            </a>
            {" · "}
            <a href="/guides/dashboard" className="text-[var(--token-accent)] hover:underline">
              My Event Analysis
            </a>
            {" · "}
            <a href="/guides/navigation" className="text-[var(--token-accent)] hover:underline">
              Navigation
            </a>
          </p>
        </section>
      </div>
    </section>
  )
}
