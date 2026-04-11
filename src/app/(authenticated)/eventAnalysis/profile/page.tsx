"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function ProfilePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/under-development?from=${encodeURIComponent("/eventAnalysis/profile")}`)
  }, [router])

  return null
}
