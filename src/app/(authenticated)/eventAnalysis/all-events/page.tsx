"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AllEventsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/under-development?from=${encodeURIComponent("/eventAnalysis/all-events")}`)
  }, [router])

  return null
}
