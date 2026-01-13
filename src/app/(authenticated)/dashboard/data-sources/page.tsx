'use client'

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DataSourcesPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace(`/under-development?from=${encodeURIComponent("/dashboard/data-sources")}`)
  }, [router])
  
  return null
}

