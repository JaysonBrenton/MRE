'use client'

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function MyTelemetryPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace("/under-development")
  }, [router])
  
  return null
}

