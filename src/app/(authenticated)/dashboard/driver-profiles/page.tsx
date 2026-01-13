/**
 * @fileoverview Driver Profiles page
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Page for managing driver profiles
 *
 * @purpose Displays information about the Driver Profiles feature and allows users
 *          to create and manage one or more driver profiles containing display name,
 *          transponder number, and racing preferences.
 */

'use client'

import Breadcrumbs from "@/components/Breadcrumbs"

export default function DriverProfilesPage() {
  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <Breadcrumbs
        items={[{ label: "Home", href: "/dashboard" }, { label: "My Driver Profiles" }]}
      />
      <div className="w-full min-w-0 flex flex-col space-y-6">
        <div>
          <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
            My Driver Profiles
          </h1>
          <p className="mt-2 text-base text-[var(--token-text-secondary)]">
            Manage driver profiles
          </p>
        </div>

        <div className="mt-8 w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
          <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-3">
            About Driver Profiles
          </h2>
          <div className="space-y-4 text-[var(--token-text-secondary)]">
            <p>
              Driver Profiles allow you to create and manage one or more driver profiles that
              contain information related to your racing identity and preferences. Each profile can
              store:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong className="text-[var(--token-text-primary)]">Profile Name:</strong> A
                descriptive name for your driver profile (e.g., &quot;Primary Driver&quot;, &quot;Race Day Profile&quot;)
              </li>
              <li>
                <strong className="text-[var(--token-text-primary)]">Display Name:</strong> Your
                display name or nickname that will be shown in race results and event listings
              </li>
              <li>
                <strong className="text-[var(--token-text-primary)]">Transponder Number:</strong>{" "}
                Your transponder number for automatic race timing and result tracking
              </li>
              <li>
                <strong className="text-[var(--token-text-primary)]">Racing Preferences:</strong>{" "}
                Custom preferences and settings stored as flexible JSON data, such as racing style,
                preferred classes, or other personal racing configurations
              </li>
            </ul>
            <p>
              This feature helps you manage multiple racing identities or different profiles for
              different racing contexts, making it easier to track your performance across various
              events and racing series.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
