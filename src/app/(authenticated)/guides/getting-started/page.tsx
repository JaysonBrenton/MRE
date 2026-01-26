/**
 * @fileoverview Getting Started guide page
 *
 * @created 2025-01-28
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Getting Started guide for My Race Engineer users
 *
 * @purpose Provides an introduction and getting started guide for new users
 *          to help them understand how to use the My Race Engineer platform.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - src/components/dashboard/shell/AdaptiveNavigationRail.tsx (navigation)
 * - docs/user-guides/getting-started.md (markdown documentation)
 */

import Breadcrumbs from "@/components/Breadcrumbs"

export default async function GettingStartedPage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
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
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            My Race Engineer (MRE) is a comprehensive RC racing telemetry platform that helps you
            discover, import, and analyze race event data from LiveRC. Whether you&apos;re a casual racer
            or a competitive driver, MRE provides the tools you need to understand your performance and
            improve your racing.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Creating Your Account
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            To create an account, navigate to the registration page and fill out the form with:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li><strong className="text-[var(--token-text-primary)]">Email or Username</strong> (required): Enter your email address or choose a username</li>
            <li><strong className="text-[var(--token-text-primary)]">Password</strong> (required): Create a secure password (minimum 8 characters)</li>
            <li><strong className="text-[var(--token-text-primary)]">Driver Name</strong> (required): Enter your racing name as it appears in race results</li>
            <li><strong className="text-[var(--token-text-primary)]">Team Name</strong> (optional): Enter your team name if applicable</li>
          </ul>
          <p className="mt-4 text-[var(--token-text-secondary)]">
            <strong className="text-[var(--token-text-primary)]">Important:</strong> Your driver name is used to automatically discover events where you participated. Make sure it matches how your name appears in race results.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Logging In
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            After creating your account, you&apos;ll be automatically logged in. On future visits, enter your{" "}
            <strong className="text-[var(--token-text-primary)]">Email or Username</strong> and{" "}
            <strong className="text-[var(--token-text-primary)]">Password</strong>, then click{" "}
            <strong className="text-[var(--token-text-primary)]">Sign In</strong>. If you have trouble logging in, verify your credentials, check that caps lock is off, and ensure your account hasn&apos;t been locked.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Understanding the Welcome Page
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            After logging in, you&apos;ll see the Welcome page with the message{" "}
            <strong className="text-[var(--token-text-primary)]">&quot;Welcome back [Your Driver Name]&quot;</strong>. This page confirms you&apos;re successfully logged in and ready to start using MRE. From here, you can navigate to My Event Analysis, Event Search, My Events, or Guides.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Basic Navigation
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            MRE uses several navigation patterns:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li><strong className="text-[var(--token-text-primary)]">Breadcrumb Navigation:</strong> Shows your current location (e.g., Home &gt; Guides &gt; Getting Started)</li>
            <li><strong className="text-[var(--token-text-primary)]">Main Navigation Menu:</strong> Provides access to My Event Analysis, Event Search, My Events, and Guides</li>
            <li><strong className="text-[var(--token-text-primary)]">Tab Navigation:</strong> Some pages use tabs to organize related content</li>
          </ul>
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
              Monitor your performance over time using My Event Analysis and My Events pages.
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
              Connect data sources and view telemetry traces. This feature will allow you to configure
              telemetry data sources, import trace data, and visualize your racing telemetry (coming soon).
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Next Steps
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Now that you understand the basics, explore these guides to learn more:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li><a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">Event Search Guide</a>: Learn how to search for and import race events</li>
            <li><a href="/guides/event-analysis" className="text-[var(--token-accent)] hover:underline">Event Analysis Guide</a>: Discover how to analyze event data and compare drivers</li>
            <li><a href="/guides/dashboard" className="text-[var(--token-accent)] hover:underline">My Event Analysis Guide</a>: Understand how to use your event analysis and customize widgets</li>
            <li><a href="/guides/navigation" className="text-[var(--token-accent)] hover:underline">Navigation Guide</a>: Master navigation patterns and keyboard shortcuts</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Need Help?
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            If you have questions or need assistance, explore the other guides in the User Guides section,
            check the <a href="/guides/troubleshooting" className="text-[var(--token-accent)] hover:underline">Troubleshooting Guide</a> for common issues, or contact support if you need additional help.
          </p>
        </section>
      </div>
    </section>
  )
}
