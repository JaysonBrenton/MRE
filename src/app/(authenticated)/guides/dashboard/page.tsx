/**
 * @fileoverview Dashboard guide page
 *
 * @created 2026-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Dashboard guide for My Race Engineer users
 *
 * @purpose Provides comprehensive instructions for using the dashboard, understanding
 *          widgets, customizing layouts, and viewing statistics.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - docs/user-guides/dashboard.md (markdown documentation)
 */

import Breadcrumbs from "@/components/Breadcrumbs"

export default async function DashboardGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "My Event Analysis" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">My Event Analysis Guide</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Learn how to use your personal event analysis to view statistics, customize widgets, and track
          your racing performance over time.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            My Event Analysis is your personal command center in MRE. It provides quick access to your
            statistics, recent events, and key actions. You can customize your event analysis to show the
            information most important to you.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Accessing My Event Analysis
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Click <strong className="text-[var(--token-text-primary)]">My Event Analysis</strong> in the main navigation menu, or click{" "}
            <strong className="text-[var(--token-text-primary)]">Home</strong> from any breadcrumb navigation. My Event Analysis is typically the first page you see after logging in.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Understanding Widgets
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Widgets are modular components that display specific information:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li><strong className="text-[var(--token-text-primary)]">Stat Cards:</strong> Display key metrics like event count, track count, and performance trends</li>
            <li><strong className="text-[var(--token-text-primary)]">Charts and Graphs:</strong> Visual representations of your data (line charts, bar charts, pie charts)</li>
            <li><strong className="text-[var(--token-text-primary)]">Recent Activity Feeds:</strong> Show your latest actions and imported events</li>
            <li><strong className="text-[var(--token-text-primary)]">Quick Action Buttons:</strong> Fast access to common tasks like Event Search and My Events</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Customizing My Event Analysis
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            You can customize your event analysis by showing/hiding widgets, rearranging them via drag and drop, and resizing widgets. Your layout changes save automatically and persist across sessions. Use the &quot;Reset Layout&quot; button to return to the default arrangement.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Viewing Statistics
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            My Event Analysis shows statistics relevant to you, including events imported, events analyzed, tracks searched, and performance metrics like best lap time, average lap time, and consistency score. Track your usage with recent activity and favorite tracks.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Quick Actions
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            My Event Analysis provides quick access to common tasks:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li><strong className="text-[var(--token-text-primary)]">Search Events:</strong> Navigate directly to Event Search</li>
            <li><strong className="text-[var(--token-text-primary)]">View My Events:</strong> See all events you&apos;ve imported or discovered</li>
            <li><strong className="text-[var(--token-text-primary)]">Import New Event:</strong> Quick access to import new events</li>
            <li><strong className="text-[var(--token-text-primary)]">Access Guides:</strong> Navigate to User Guides section</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Tips and Best Practices
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>Prioritize important widgets by placing them at the top</li>
            <li>Group related widgets together for better organization</li>
            <li>Use available space efficiently with multi-column layouts on desktop</li>
            <li>Check statistics regularly to track your progress</li>
            <li>Use quick actions to streamline your workflow</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related Guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            Learn how to find events in the <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">Event Search Guide</a>, analyze them in the <a href="/guides/event-analysis" className="text-[var(--token-accent)] hover:underline">Event Analysis Guide</a>, or master navigation in the <a href="/guides/navigation" className="text-[var(--token-accent)] hover:underline">Navigation Guide</a>.
          </p>
        </section>
      </div>
    </section>
  )
}

