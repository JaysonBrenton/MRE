/**
 * @fileoverview Guides index page
 * 
 * @created 2025-01-28
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 * 
 * @description Guides index page listing all available user guides
 * 
 * @purpose Provides a central location for users to discover and access
 *          all available guides and documentation.
 * 
 * @relatedFiles
 * - src/components/Breadcrumbs.tsx (breadcrumb navigation)
 * - src/app/(authenticated)/guides/getting-started/page.tsx (getting started guide)
 */

import Breadcrumbs from "@/components/Breadcrumbs"
import Link from "next/link"

export default async function GuidesPage() {
  const guides = [
    {
      title: "Getting Started",
      href: "/guides/getting-started",
      description: "Welcome to My Race Engineer. This guide will help you get started with the platform.",
    },
  ]

  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/welcome" },
          { label: "Guides" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">User Guides</h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Explore our guides to learn how to use My Race Engineer effectively.
        </p>
      </header>

      <div className="space-y-4">
        {guides.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            className="block rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6 transition-colors hover:border-[var(--token-border-hover)] hover:bg-[var(--token-surface-hover)]"
          >
            <h2 className="mb-2 text-xl font-semibold text-[var(--token-text-primary)]">
              {guide.title}
            </h2>
            <p className="text-sm text-[var(--token-text-secondary)]">{guide.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

