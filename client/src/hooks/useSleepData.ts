import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend } from '../lib/garminApi'
import { SLEEP } from '../lib/stubData'

export type SleepData = typeof SLEEP & {
  sleepHr?: number | null
  sleepStress?: number | null
}

export function useSleepData(): { data: SleepData; loading: boolean } {
  const [data, setData] = useState<SleepData>(SLEEP)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, scoreTrend, deepTrend] = await Promise.all([
          fetchSummary(),
          fetchTrend('sleep_score'),
          fetchTrend('sleep_deep_s'),
        ])
        if (cancelled) return

        const deepS  = summary.sleep_deep_s  ?? 0
        const lightS = summary.sleep_light_s ?? 0
        const remS   = summary.sleep_rem_s   ?? 0
        const awakeS = summary.sleep_awake_s ?? 0
        const totalMins = Math.round((deepS + lightS + remS) / 60)
        const deepMins  = Math.round(deepS  / 60)
        const lightMins = Math.round(lightS / 60)
        const remMins   = Math.round(remS   / 60)
        const awakeMins = Math.round(awakeS / 60)
        const totalForPct = deepMins + lightMins + remMins || 1

        setData({
          ...SLEEP,
          duration: {
            h:    Math.floor(totalMins / 60),
            m:    totalMins % 60,
            mins: totalMins,
            inBed: totalMins + awakeMins,
            trend: deepTrend.map(v => Math.round(v / 60)).filter(v => v > 0).length
              ? deepTrend.map(v => Math.round(v / 60))
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
          resp: { avg: summary.sleep_resp ?? SLEEP.resp.avg, unit: 'br/min' },
          spo2: SLEEP.spo2,
          sleepHr:     summary.sleep_hr     ?? null,
          sleepStress: summary.sleep_stress ?? null,
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
