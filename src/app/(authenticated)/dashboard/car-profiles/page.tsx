/**
 * @fileoverview Car Profiles page
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Page for managing car profiles and setups
 *
 * @purpose Displays information about the Car Profiles feature and allows users
 *          to create and manage car profiles containing car type, vehicle type,
 *          and setup information.
 */

'use client'

import Breadcrumbs from "@/components/Breadcrumbs"

export default function CarProfilesPage() {
  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <Breadcrumbs
        items={[{ label: "Home", href: "/dashboard" }, { label: "My Car Profiles" }]}
      />
      <div className="w-full min-w-0 flex flex-col space-y-6">
        <div>
          <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
            My Car Profiles
          </h1>
          <p className="mt-2 text-base text-[var(--token-text-secondary)]">
            Manage car profiles & setups
          </p>
        </div>

        <div className="mt-8 w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
          <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-3">
            About Car Profiles
          </h2>
          <div className="space-y-4 text-[var(--token-text-secondary)]">
            <p>
              Car Profiles allow you to create and manage one or more car profiles that contain
              information related to your car type and setup. Each profile can store:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong className="text-[var(--token-text-primary)]">Profile Name:</strong> A
                descriptive name for your car profile (e.g., &quot;My Buggy&quot;, &quot;Race Car #1&quot;)
              </li>
              <li>
                <strong className="text-[var(--token-text-primary)]">Car Type:</strong> The scale
                and type of your car (e.g., &quot;1/10 scale&quot;, &quot;1/8 scale&quot;, &quot;buggy&quot;, &quot;truggy&quot;)
              </li>
              <li>
                <strong className="text-[var(--token-text-primary)]">Vehicle Type:</strong> The
                power source for your car (e.g., &quot;electric&quot;, &quot;nitro&quot;, &quot;gas&quot;)
              </li>
              <li>
                <strong className="text-[var(--token-text-primary)]">Setup Information:</strong>{" "}
                Detailed setup data including suspension settings, gearing configurations, and
                other tuning parameters stored as flexible JSON data
              </li>
            </ul>
            <p>
              This feature helps you organize and track different car configurations, making it
              easier to manage multiple vehicles or different setups for the same car across
              different tracks or racing conditions.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
