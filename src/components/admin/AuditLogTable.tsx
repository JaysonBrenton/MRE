"use client"
import { useEffect, useState } from "react"

interface AuditLog {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  createdAt: string
  user: { email: string } | null
}

export default function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/v1/admin/audit?pageSize=50")
      .then((r) => r.json())
      .then((d) => d.success && setLogs(d.data.logs))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="py-8 text-center">Loading...</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left">Time</th>
            <th className="px-4 py-3 text-left">User</th>
            <th className="px-4 py-3 text-left">Action</th>
            <th className="px-4 py-3 text-left">Resource</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b">
              <td className="px-4 py-3 text-sm">{new Date(log.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm">{log.user?.email || "System"}</td>
              <td className="px-4 py-3 text-sm">{log.action}</td>
              <td className="px-4 py-3 text-sm">{log.resourceType} {log.resourceId ? `(${log.resourceId.substring(0, 8)})` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

