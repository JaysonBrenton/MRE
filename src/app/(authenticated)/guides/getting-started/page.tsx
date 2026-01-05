/**
 * @fileoverview Getting Started guide page
 *
 * @created 2025-01-28
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 *
 * @description Getting Started guide for My Race Engineer users
 *
 * @purpose Provides an introduction and getting started guide for new users
 *          to help them understand how to use the My Race Engineer platform.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - src/components/dashboard/shell/AdaptiveNavigationRail.tsx (navigation)
 */

import Breadcrumbs from "@/components/Breadcrumbs"

export default async function GettingStartedPage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "Getting Started" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">Getting Started</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Welcome to My Race Engineer. This guide will help you get started with the platform.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Welcome to My Race Engineer
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            My Race Engineer (MRE) is your comprehensive RC racing telemetry platform. This guide
            will walk you through the essential features and help you get the most out of the
            platform.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Quick Start
          </h2>
          <ol className="list-decimal space-y-3 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Complete your profile:</strong>{" "}
              Make sure your driver name and team information are up to date in Settings.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Search for events:</strong> Use
              the Event Search feature to find and import racing events from LiveRC.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">
                Analyze your performance:
              </strong>{" "}
              View detailed event analysis to understand your lap times, consistency, and compare
              with other drivers.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Track your progress:</strong>{" "}
              Monitor your performance over time using the Dashboard and My Events pages.
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Key Features
          </h2>
          <ul className="list-disc space-y-3 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Event Discovery:</strong> Search
              and import events from LiveRC with ease.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Performance Analysis:</strong>{" "}
              Detailed lap time analysis, consistency metrics, and driver comparisons.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Driver Management:</strong> Link
              your driver profile to events and manage your racing identity.
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Telemetry Integration:</strong>{" "}
              Connect data sources and view telemetry traces (coming soon).
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Need Help?
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            For more detailed information, explore the other guides in the User Guides section of
            the sidebar. If you have questions or need assistance, please contact support.
          </p>
        </section>
      </div>
    </section>
  )
}
