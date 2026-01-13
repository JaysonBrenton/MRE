'use client'

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function MyEngineerPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace(`/under-development?from=${encodeURIComponent("/dashboard/my-engineer")}`)
  }, [router])
  
  return null
}

