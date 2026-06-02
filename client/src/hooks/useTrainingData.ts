import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend, fetchActivities, TRAINING_STATUS, type GarminActivity } from '../lib/garminApi'
import { TRAINING } from '../lib/stubData'

export type TrainingData = Omit<typeof TRAINING, 'activities' | 'vo2max'> & {
  activities: GarminActivity[]
  vo2max: {
    value: number
    unit: string
    delta: number
    fitnessAge: number | string
    trend: number[]
  }
  dailyActivity: {
    steps: number | null
    distanceKm: number | null
    caloriesTotal: number | null
    caloriesActive: number | null
    floors: number | null
    stepsTrend: number[]
    calTrend: number[]
  }
  hrZones: Array<{
    zone: number
    label: string
    mins: number
    pct: number
    color: string
  }>
}

const ZONE_META = [
  { zone: 1, label: 'Warm Up',   color: '#56657a' },
  { zone: 2, label: 'Easy',      color: '#4ade80' },
  { zone: 3, label: 'Aerobic',   color: '#fbbf24' },
  { zone: 4, label: 'Threshold', color: '#f87171' },
  { zone: 5, label: 'Maximum',   color: '#ef4444' },
]

const INITIAL: TrainingData = {
  ...TRAINING,
  activities: [],
  vo2max: { ...TRAINING.vo2max, trend: [] },
  dailyActivity: {
    steps: null, distanceKm: null, caloriesTotal: null,
    caloriesActive: null, floors: null, stepsTrend: [], calTrend: [],
  },
  hrZones: [],
}

export function useTrainingData(): { data: TrainingData; loading: boolean } {
  const [data, setData] = useState<TrainingData>(INITIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, loadTrend, intensityTrend, vo2maxTrend, stepsTrend, calTrend, activities] =
          await Promise.all([
            fetchSummary(),
            fetchTrend('training_load'),
            fetchTrend('intensity_vig_min'),
            fetchTrend('vo2max', 30),
            fetchTrend('steps'),
            fetchTrend('calories_total'),
            fetchActivities(8),
          ])
        if (cancelled) return

        const statusN = summary.training_status_n ?? null
        const statusLabel = statusN != null
          ? (TRAINING_STATUS[Math.round(statusN)] ?? 'Maintaining')
          : TRAINING.status.value

        const trainingLoad = summary.training_load
        const loadMin  = summary.training_load_min ?? TRAINING.load.low
        const loadMax  = summary.training_load_max ?? TRAINING.load.high
        const loadState = trainingLoad != null
          ? trainingLoad < loadMin ? 'Under'
          : trainingLoad > loadMax ? 'High'
          : 'Optimal'
          : TRAINING.load.state

        const distanceKm = summary.distance_m != null
          ? Math.round(summary.distance_m / 100) / 10
          : null

        const zoneMins = [
          summary.hrzone_1_min ?? null,
          summary.hrzone_2_min ?? null,
          summary.hrzone_3_min ?? null,
          summary.hrzone_4_min ?? null,
          summary.hrzone_5_min ?? null,
        ]
        const totalZoneMins = zoneMins.reduce<number>((s, v) => s + (v ?? 0), 0)
        const hrZones = totalZoneMins > 0
          ? ZONE_META.map((m, i) => ({
              ...m,
              mins: zoneMins[i] ?? 0,
              pct:  Math.round((zoneMins[i] ?? 0) / totalZoneMins * 100),
            }))
          : []

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
            trend:      vo2maxTrend,
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
          dailyActivity: {
            steps:          summary.steps           ?? null,
            distanceKm,
            caloriesTotal:  summary.calories_total  ?? null,
            caloriesActive: summary.calories_active ?? null,
            floors:         summary.floors_up        ?? null,
            stepsTrend,
            calTrend,
          },
          hrZones,
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
