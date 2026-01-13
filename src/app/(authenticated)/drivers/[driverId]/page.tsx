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
interface DriverDetailsPageProps {
  params: Promise<{
    driverId: string
  }>
  searchParams: Promise<{
    eventId?: string
  }>
}

export default async function DriverDetailsPage({ params, searchParams }: DriverDetailsPageProps) {
  // Properly await and resolve the Promises immediately to avoid serialization errors
  const { driverId } = await params
  // searchParams is available but not currently used - await it if needed in the future
  await searchParams

  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const driverRoute = `/drivers/${driverId}`
  redirect(`/under-development?from=${encodeURIComponent(driverRoute)}`)
}
