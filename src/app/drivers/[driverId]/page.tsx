/**
 * @fileoverview Driver Details page
 * 
 * @created 2025-12-24
 * @creator Jayson Brenton
 * @lastModified 2025-12-24
 * 
 * @description Driver details page showing transponder numbers, multi-class participation, and override management
 * 
 * @purpose Provides driver profile view with transponder information and override management UI
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AuthenticatedNav from "@/components/AuthenticatedNav"
import DriverDetailsClient from "./DriverDetailsClient"
import { getDriverWithEventEntries } from "@/core/drivers/repo"

interface DriverDetailsPageProps {
  params: Promise<{
    driverId: string
  }>
  searchParams: Promise<{
    eventId?: string
  }>
}

export default async function DriverDetailsPage({ params, searchParams }: DriverDetailsPageProps) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const { driverId } = await params
  const { eventId } = await searchParams

  // Fetch driver data
  const driver = await getDriverWithEventEntries(driverId, eventId)

  if (!driver) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--token-surface)]">
        <AuthenticatedNav />
        <main className="page-container flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <section className="content-wrapper mx-auto max-w-4xl">
            <div className="text-center space-y-4">
              <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
                Driver Not Found
              </h1>
              <p className="text-[var(--token-text-secondary)]">
                The driver you're looking for doesn't exist or has been removed.
              </p>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--token-surface)]">
      <AuthenticatedNav />
      <main className="page-container flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <section className="content-wrapper mx-auto max-w-4xl">
          <DriverDetailsClient driver={driver} eventId={eventId} />
        </section>
      </main>
    </div>
  )
}

