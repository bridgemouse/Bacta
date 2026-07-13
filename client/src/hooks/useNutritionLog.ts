import { useState, useEffect, useCallback } from 'react'
import { fetchLog, fetchSummary, type LogResponse, type NutritionSummary } from '../lib/nutritionApi'

export function useNutritionLog(date: string): {
  log: LogResponse | null
  summary: NutritionSummary | null
  loading: boolean
  refresh: () => void
} {
  const [log, setLog] = useState<LogResponse | null>(null)
  const [summary, setSummary] = useState<NutritionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const refresh = useCallback(() => setRefreshTrigger(n => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      try {
        const [logData, summaryData] = await Promise.all([fetchLog(date), fetchSummary(date)])
        if (cancelled) return
        setLog(logData)
        setSummary(summaryData)
      } catch {
        // keep previous data on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [date, refreshTrigger])

  return { log, summary, loading, refresh }
}
