import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend, fetchSources } from '../lib/garminApi'
import { SLEEP } from '../lib/stubData'

export type SleepData = Omit<typeof SLEEP, 'spo2'> & {
  spo2: { avg: number | null; low: number | null; unit: string }
  sleepHr?: number | null
  sleepStress?: number | null
  sleepDebt?: number
  deepRatio?: number
  remRatio?: number
  sleepRespTrend: number[]
  sleepHrTrend: number[]
  sleepStressTrend: number[]
  sleepSpo2Trend: number[]
  archScore: number | undefined
  archDeepScore?: number
  archRemScore?: number
  archAwakePenalty?: number
  hypnoStartLocal: number | null
  hypnoEndLocal: number | null
}

const INITIAL: SleepData = {
  ...SLEEP,
  spo2: { avg: null, low: null, unit: '%' },
  sleepRespTrend: [],
  sleepHrTrend: [],
  sleepStressTrend: [],
  sleepSpo2Trend: [],
  archScore: undefined,
  archDeepScore: undefined,
  archRemScore: undefined,
  archAwakePenalty: undefined,
  hypnoStartLocal: null,
  hypnoEndLocal: null,
}

export function useSleepData(): { data: SleepData; loading: boolean; sources: Record<string, string> } {
  const [data, setData] = useState<SleepData>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<Record<string, string>>({})
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
        const [
          summary,
          scoreTrend,
          deepTrend,
          respTrend,
          hrTrend,
          stressTrend,
          spo2Trend,
          sleepSTrend,
          sourcesData,
        ] = await Promise.all([
            fetchSummary(),
            fetchTrend('sleep_score'),
            fetchTrend('sleep_deep_s'),
            fetchTrend('sleep_resp'),
            fetchTrend('sleep_hr'),
            fetchTrend('sleep_stress'),
            fetchTrend('sleep_spo2'),
            fetchTrend('sleep_s'),
            fetchSources(),
          ])
        if (cancelled) return
        setSources(sourcesData)

        let hypnoData = { hypno: [] as number[], startLocal: null as number | null, endLocal: null as number | null }
        try {
          const hypnoRes = await fetch('/api/garmin/sleep-hypno')
          if (hypnoRes.ok) {
            const json = await hypnoRes.json() as { hypno: number[]; startLocal: number | null; endLocal: number | null }
            if (json.hypno && json.hypno.length === 24) {
              hypnoData = json
            }
          }
        } catch {
          // use stub on error
        }

        const deepS  = summary.sleep_deep_s  ?? 0
        const lightS = summary.sleep_light_s ?? 0
        const remS   = summary.sleep_rem_s   ?? 0
        const awakeS = summary.sleep_awake_s ?? 0
        const sleepS = summary.sleep_s ?? (deepS + lightS + remS)
        const totalMins = Math.round(sleepS / 60)
        const deepMins  = Math.round(deepS  / 60)
        const lightMins = Math.round(lightS / 60)
        const remMins   = Math.round(remS   / 60)
        const awakeMins = Math.round(awakeS / 60)
        const totalForPct = deepMins + lightMins + remMins || 1
        const deepTrendMins = deepTrend.map(v => Math.round(v / 60))

        // Cumulative debt over the trailing week: sum of each night's shortfall vs the
        // 8h target. A well-rested night clamps to 0 rather than offsetting other nights'
        // debt, matching how sleep debt is conventionally understood to accumulate.
        const sleepDebt = sleepSTrend.length > 0
          ? sleepSTrend.reduce((sum, s) => sum + Math.max(0, 480 - Math.round(s / 60)), 0)
          : totalMins > 0 ? Math.max(0, 480 - totalMins) : undefined
        const deepRatio = totalMins > 0 ? Math.round(deepMins / totalMins * 100) : undefined
        const remRatio  = totalMins > 0 ? Math.round(remMins  / totalMins * 100) : undefined

        let archScore: number | undefined
        let archDeepScore: number | undefined
        let archRemScore: number | undefined
        let archAwakePenalty: number | undefined

        if (totalMins > 0) {
          archDeepScore = Math.min(deepMins / (totalMins * 0.20), 1)
          archRemScore  = Math.min(remMins  / (totalMins * 0.22), 1)
          archAwakePenalty  = Math.max(0, Math.min(1, 2 - awakeMins / (totalMins * 0.05)))
          archScore = Math.round((archDeepScore * 0.4 + archRemScore * 0.4 + archAwakePenalty * 0.2) * 100)
        }

        setData({
          ...SLEEP,
          hypno: hypnoData.hypno.length === 24 ? hypnoData.hypno : SLEEP.hypno,
          duration: {
            h:     Math.floor(totalMins / 60),
            m:     totalMins % 60,
            mins:  totalMins,
            inBed: totalMins + awakeMins,
            trend: deepTrendMins.filter(v => v > 0).length
              ? deepTrendMins
              : SLEEP.duration.trend,
          },
          score: {
            value: summary.sleep_score ?? SLEEP.score.value,
            state: (summary.sleep_score ?? 0) >= 85 ? 'Excellent'
                 : (summary.sleep_score ?? 0) >= 70 ? 'Good'
                 : 'Fair',
            trend: scoreTrend.length ? scoreTrend : SLEEP.score.trend,
          },
          stages: deepMins > 0 ? [
            { key: 'deep' as const,  label: 'Deep',  mins: deepMins,  pct: Math.round(deepMins  / totalForPct * 100), color: '#7c5cff' },
            { key: 'light' as const, label: 'Light', mins: lightMins, pct: Math.round(lightMins / totalForPct * 100), color: '#a78bfa' },
            { key: 'rem' as const,   label: 'REM',   mins: remMins,   pct: Math.round(remMins   / totalForPct * 100), color: '#c4b5fd' },
            { key: 'awake' as const, label: 'Awake', mins: awakeMins, pct: 0, color: '#56657a' },
          ] : SLEEP.stages,
          spo2:        { avg: summary.sleep_spo2 ?? null, low: null, unit: '%' },
          resp:        { avg: summary.sleep_resp ?? SLEEP.resp.avg, unit: 'br/min' },
          sleepHr:     summary.sleep_hr     ?? null,
          sleepStress: summary.sleep_stress ?? null,
          sleepDebt,
          deepRatio,
          remRatio,
          archScore,
          archDeepScore,
          archRemScore,
          archAwakePenalty,
          sleepRespTrend:   respTrend,
          sleepHrTrend:     hrTrend,
          sleepStressTrend: stressTrend,
          sleepSpo2Trend:   spo2Trend,
          hypnoStartLocal:  hypnoData.startLocal,
          hypnoEndLocal:    hypnoData.endLocal,
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

  return { data, loading, sources }
}
