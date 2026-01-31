/**
 * @fileoverview Navigation guide page
 *
 * @created 2026-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Navigation guide for My Race Engineer users
 *
 * @purpose Provides comprehensive instructions for using breadcrumb navigation, menus,
 *          tabs, keyboard shortcuts, and finding features throughout the application.
 *
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - docs/user-guides/navigation.md (markdown documentation)
 */

import Breadcrumbs from "@/components/atoms/Breadcrumbs"

export default async function NavigationGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "Guides", href: "/guides" },
          { label: "Navigation" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">Navigation Guide</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Learn how to navigate My Race Engineer effectively using breadcrumbs, menus, tabs,
          keyboard shortcuts, and other navigation patterns.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Introduction
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            MRE uses several navigation patterns to help you move through the application
            efficiently. Understanding these patterns will help you find features quickly and
            navigate with confidence.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Breadcrumb Navigation
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Breadcrumb navigation is the{" "}
            <strong className="text-[var(--token-text-primary)]">primary navigation pattern</strong>{" "}
            in MRE. It shows your current location and provides a path back to previous sections.
            Click any breadcrumb item to navigate back to that section.
          </p>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            <strong className="text-[var(--token-text-primary)]">Example:</strong>{" "}
            <code className="text-[var(--token-text-primary)]">
              Home &gt; Event Search &gt; Event Analysis
            </code>
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Main Navigation Menu
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            The main navigation provides access to all major sections:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">My Event Analysis:</strong> Your
              personal event analysis with statistics
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Event Search:</strong> Search for
              race events
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">My Events:</strong> View all your
              events
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Guides:</strong> User guides and
              documentation
            </li>
          </ul>
          <div className="mt-4 rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-4">
            <h3 className="mb-2 text-sm font-semibold text-[var(--token-text-primary)]">
              Guides Menu in Collapsed Sidebar
            </h3>
            <p className="mb-2 text-sm text-[var(--token-text-secondary)]">
              When the sidebar is collapsed (icon-only mode), the guides section has special
              behavior:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--token-text-secondary)]">
              <li>Click the guides icon to expand a menu showing all available guides</li>
              <li>The icon rotates when expanded to indicate its state</li>
              <li>Each guide appears as an icon with a tooltip showing its name</li>
              <li>Clicking a guide navigates to it while keeping the menu open</li>
              <li>Click the guides icon again to collapse the menu</li>
            </ul>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Tab Navigation
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Some pages use tabs to organize related content. Click or tap a tab to switch to that
            section. Use arrow keys to move between tabs, and Enter or Space to select. The active
            tab is highlighted.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Keyboard Shortcuts
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            MRE supports keyboard shortcuts for common actions:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Alt + H:</strong> Go to Home/My
              Event Analysis
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Alt + S:</strong> Go to Event
              Search
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Alt + E:</strong> Go to My Events
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Alt + G:</strong> Go to Guides
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Esc:</strong> Close modals or
              menus
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Arrow Left/Right:</strong> Switch
              between tabs
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Finding Features
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Use the navigation menu to browse sections, check breadcrumbs to understand your
            location, or explore the Guides section to learn where features are located. Global
            search (if available) can help you find features quickly.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Mobile vs Desktop Differences
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            On desktop, you&apos;ll see sidebar navigation (usually always visible) with hover
            interactions. On mobile, navigation uses a hamburger menu (hidden by default) with touch
            interactions and full-screen overlays. Navigation adapts automatically to your screen
            size.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Navigation Tips
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>Use breadcrumbs to go back multiple levels quickly</li>
            <li>Learn keyboard shortcuts to save time</li>
            <li>Check breadcrumbs to always know where you are</li>
            <li>Click Home to always return to My Event Analysis</li>
            <li>Use the menu to browse all sections</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related Guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            Learn the basics in the{" "}
            <a
              href="/guides/getting-started"
              className="text-[var(--token-accent)] hover:underline"
            >
              Getting Started Guide
            </a>
            , explore your{" "}
            <a href="/guides/dashboard" className="text-[var(--token-accent)] hover:underline">
              My Event Analysis
            </a>
            , or learn about{" "}
            <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">
              Event Search
            </a>{" "}
            navigation.
          </p>
        </section>
      </div>
    </section>
  )
}
