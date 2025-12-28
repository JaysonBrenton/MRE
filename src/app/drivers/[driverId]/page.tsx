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
  // Properly await and destructure the Promises immediately to avoid serialization errors
  // This must happen before any other operations to prevent React DevTools from enumerating the Promises
  const { driverId } = await params
  const { eventId } = await searchParams

  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  redirect("/under-development")
}
