import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend, fetchActivities, fetchWeeklyVolume, fetchWeeklyAvgHr, fetchWeeklyIntensity, TRAINING_STATUS, type GarminActivity, type WeeklyVolume, type WeeklyAvgHr } from '../lib/garminApi'
import { TRAINING } from '../lib/stubData'

export type TrainingData = Omit<typeof TRAINING, 'activities' | 'vo2max'> & {
  activities: GarminActivity[]
  vo2max: {
    value: number
    unit: string
    delta: number
    fitnessAge: number | string
    fitnessAgeAchievable: number | null
    trend: number[]
    fitnessAgeTrend: number[]
  }
  dailyActivity: {
    steps: number | null
    distanceKm: number | null
    caloriesTotal: number | null
    caloriesActive: number | null
    floors: number | null
    stepsGoal: number
    floorsGoal: number
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
  loadRatio: {
    value: number
    acute: number
    chronic: number
    state: 'Optimal' | 'High' | 'Low'
  } | null
  weeklyVolume: WeeklyVolume[] | null
  activityHrByWeek: WeeklyAvgHr[] | null
}

function formatShortDate(dateStr: string): string {
  const [year, month, dom] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, dom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  vo2max: { ...TRAINING.vo2max, fitnessAgeAchievable: null, trend: [], fitnessAgeTrend: [] },
  dailyActivity: {
    steps: null, distanceKm: null, caloriesTotal: null,
    caloriesActive: null, floors: null, stepsGoal: 10000, floorsGoal: 10, stepsTrend: [], calTrend: [],
  },
  hrZones: [],
  loadRatio: null,
  weeklyVolume: null,
  activityHrByWeek: null,
}

export function useTrainingData(): { data: TrainingData; loading: boolean } {
  const [data, setData] = useState<TrainingData>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const handler = () => setRefreshTrigger(n => n + 1)
    window.addEventListener('bacta:sync-complete', handler)
    return () => window.removeEventListener('bacta:sync-complete', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, loadTrend, intensityTrend, vo2maxTrend, stepsTrend, calTrend, activities, load42Trend, fitnessAgeTrend, weeklyVolume, activityHrByWeek, weeklyIntensity] =
          await Promise.all([
            fetchSummary(),
            fetchTrend('training_load'),
            fetchTrend('intensity_vig_min'),
            fetchTrend('vo2max', 30),
            fetchTrend('steps'),
            fetchTrend('calories_total'),
            fetchActivities(8),
            fetchTrend('training_load', 42),
            fetchTrend('fitness_age', 30),
            fetchWeeklyVolume(),
            fetchWeeklyAvgHr(),
            fetchWeeklyIntensity(),
          ])
        if (cancelled) return

        const statusN = summary.training_status_n ?? null
        const statusLabel = statusN != null
          ? (TRAINING_STATUS[Math.round(statusN)] ?? 'Maintaining')
          : TRAINING.status.value

        const statusSub = summary.training_status_n_date
          ? `as of ${formatShortDate(summary.training_status_n_date)}`
          : ''

        const trainingLoad = summary.training_load
        const loadMin  = summary.training_load_min ?? TRAINING.load.low
        const loadMax  = summary.training_load_max ?? TRAINING.load.high
        const loadState = trainingLoad != null
          ? trainingLoad < loadMin ? 'Under'
          : trainingLoad > loadMax ? 'High'
          : 'Optimal'
          : TRAINING.load.state

        const acuteLoad = trainingLoad
        const chronicLoad = load42Trend.length >= 7
          ? load42Trend.reduce((s, v) => s + v, 0) / load42Trend.length
          : null
        const loadRatio = acuteLoad != null && chronicLoad != null && chronicLoad > 0
          ? {
              value: Math.round((acuteLoad / chronicLoad) * 100) / 100,
              acute: Math.round(acuteLoad),
              chronic: Math.round(chronicLoad),
              state: acuteLoad / chronicLoad < 0.8 ? 'Low' as const
                   : acuteLoad / chronicLoad > 1.3 ? 'High' as const
                   : 'Optimal' as const,
            }
          : null

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
          ? (() => {
              const raw = ZONE_META.map((m, i) => ({
                ...m,
                mins: zoneMins[i] ?? 0,
                exact: ((zoneMins[i] ?? 0) / totalZoneMins) * 100,
              }))
              const floored = raw.map(z => ({ ...z, pct: Math.floor(z.exact) }))
              const remainder = 100 - floored.reduce((s, z) => s + z.pct, 0)
              const sorted = [...floored].sort((a, b) => (b.exact - b.pct) - (a.exact - a.pct))
              sorted.slice(0, remainder).forEach(z => { z.pct++ })
              return floored.map(({ exact: _exact, ...z }) => z)
            })()
          : []

        setData({
          ...TRAINING,
          status: {
            value: statusLabel,
            sub:   statusSub,
            trend: TRAINING.status.trend,
          },
          vo2max: {
            value:                summary.vo2max                ?? TRAINING.vo2max.value,
            unit:                 'mL/kg/min',
            delta:                TRAINING.vo2max.delta,
            fitnessAge:           summary.fitness_age           ?? TRAINING.vo2max.fitnessAge,
            fitnessAgeAchievable: summary.fitness_age_achievable ?? null,
            trend:                vo2maxTrend,
            fitnessAgeTrend,
          },
          load: {
            value: trainingLoad ?? TRAINING.load.value,
            low:   loadMin,
            high:  loadMax,
            state: loadState,
            trend: loadTrend.length ? loadTrend : TRAINING.load.trend,
          },
          intensity: {
            moderate: weeklyIntensity.moderate,
            vigorous: weeklyIntensity.vigorous,
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
            stepsGoal:      summary.steps_goal      ?? 10000,
            floorsGoal:     summary.floors_goal     ?? 10,
            stepsTrend,
            calTrend,
          },
          hrZones,
          loadRatio,
          weeklyVolume: weeklyVolume.length ? weeklyVolume : null,
          activityHrByWeek: activityHrByWeek.length ? activityHrByWeek : null,
        })
      } catch {
        // keep stub on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshTrigger])

  return { data, loading }
}
