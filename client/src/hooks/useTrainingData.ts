import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend, fetchActivities, TRAINING_STATUS, type GarminActivity } from '../lib/garminApi'
import { TRAINING } from '../lib/stubData'

export type TrainingData = Omit<typeof TRAINING, 'activities'> & {
  activities: GarminActivity[]
}

export function useTrainingData(): { data: TrainingData; loading: boolean } {
  const [data, setData] = useState<TrainingData>({ ...TRAINING, activities: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, loadTrend, intensityTrend, activities] = await Promise.all([
          fetchSummary(),
          fetchTrend('training_load'),
          fetchTrend('intensity_vig_min'),
          fetchActivities(8),
        ])
        if (cancelled) return

        const statusN = summary.training_status_n ?? null
        const statusLabel = statusN != null
          ? (TRAINING_STATUS[Math.round(statusN)] ?? 'Maintaining')
          : TRAINING.status.value

        const trainingLoad = summary.training_load
        const loadMin = summary.training_load_min ?? TRAINING.load.low
        const loadMax = summary.training_load_max ?? TRAINING.load.high
        const loadState = trainingLoad != null
          ? trainingLoad < loadMin ? 'Under'
          : trainingLoad > loadMax ? 'High'
          : 'Optimal'
          : TRAINING.load.state

        setData({
          ...TRAINING,
          status: {
            value: statusLabel,
            sub:   TRAINING.status.sub,
            trend: TRAINING.status.trend,
          },
          vo2max: {
            value:      summary.vo2max      ?? TRAINING.vo2max.value,
            unit:       'mL/kg/min',
            delta:      TRAINING.vo2max.delta,
            fitnessAge: summary.fitness_age ?? TRAINING.vo2max.fitnessAge,
          },
          load: {
            value: trainingLoad ?? TRAINING.load.value,
            low:   loadMin,
            high:  loadMax,
            state: loadState,
            trend: loadTrend.length ? loadTrend : TRAINING.load.trend,
          },
          intensity: {
            moderate: summary.intensity_mod_min ?? TRAINING.intensity.moderate,
            vigorous: summary.intensity_vig_min ?? TRAINING.intensity.vigorous,
            goal:     150,
            trend:    intensityTrend.length ? intensityTrend : TRAINING.intensity.trend,
          },
          activities,
        })
      } catch {
        // keep stub on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
