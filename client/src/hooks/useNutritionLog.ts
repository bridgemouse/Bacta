import { useState, useEffect, useCallback } from 'react'
import { fetchLog, fetchSummary, type LogResponse, type NutritionSummary } from '../lib/nutritionApi'
import { useToast } from '../lib/ToastContext'

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
  const { showToast } = useToast()

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
        // keep previous data visible — just surface that it may be stale
        if (!cancelled) showToast('Could not load nutrition data — showing the last known data.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [date, refreshTrigger])

  return { log, summary, loading, refresh }
}
