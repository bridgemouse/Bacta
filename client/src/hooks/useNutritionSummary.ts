import { useState, useEffect } from 'react'
import { fetchSummary, type NutritionSummary } from '../lib/nutritionApi'
import { useToast } from '../lib/ToastContext'

export function useNutritionSummary(date: string): {
  summary: NutritionSummary | null
  loading: boolean
} {
  const [summary, setSummary] = useState<NutritionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      try {
        const summaryData = await fetchSummary(date)
        if (cancelled) return
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
  }, [date])

  return { summary, loading }
}
