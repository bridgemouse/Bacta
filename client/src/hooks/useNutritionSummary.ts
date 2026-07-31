import { useState, useEffect } from 'react'
import { fetchSummary, type NutritionSummary } from '../lib/nutritionApi'

export function useNutritionSummary(date: string): {
  summary: NutritionSummary | null
  loading: boolean
} {
  const [summary, setSummary] = useState<NutritionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      try {
        const summaryData = await fetchSummary(date)
        if (cancelled) return
        setSummary(summaryData)
      } catch {
        // keep previous data on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [date])

  return { summary, loading }
}
