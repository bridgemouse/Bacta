import { useState, useEffect, useCallback } from 'react'

export interface LogEntry {
  source: string
  level: 'info' | 'warn' | 'error'
  message: string
  created_at: string
}

export function useLogs() {
  const [sources, setSources] = useState<string[]>([])
  const [activeSource, setActiveSource] = useState<string>('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/logs/sources')
      .then(r => r.json())
      .then((d: { sources: string[] }) => setSources(d.sources ?? []))
      .catch(() => {})
  }, [])

  const loadLogs = useCallback(async (source: string) => {
    setLoading(true)
    try {
      const url = source ? `/api/logs?source=${encodeURIComponent(source)}` : '/api/logs'
      const res = await fetch(url)
      const data = await res.json() as { logs: LogEntry[] }
      setLogs(data.logs ?? [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs(activeSource)
  }, [activeSource, loadLogs])

  return {
    sources,
    activeSource,
    setActiveSource,
    logs,
    loading,
    reload: () => loadLogs(activeSource),
  }
}
