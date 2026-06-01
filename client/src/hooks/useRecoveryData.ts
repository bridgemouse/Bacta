import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend } from '../lib/garminApi'
import { RECOVERY } from '../lib/stubData'

export type RecoveryData = typeof RECOVERY & {
  hrvBaselineLow?: number
  hrvBaselineHigh?: number
}

export function useRecoveryData(): { data: RecoveryData; loading: boolean } {
  const [data, setData] = useState<RecoveryData>(RECOVERY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, hrvTrend, rhrTrend, battTrend, stressTrend, respTrend, scoreTrend] =
          await Promise.all([
            fetchSummary(),
            fetchTrend('hrv'),
            fetchTrend('resting_hr'),
            fetchTrend('body_battery_wake'),
            fetchTrend('stress_avg'),
            fetchTrend('resp_avg'),
            fetchTrend('recovery_score'),
          ])
        if (cancelled) return

        setData({
          score: {
            value: summary.recovery_score ?? RECOVERY.score.value,
            state: (summary.recovery_score ?? 0) >= 80 ? 'Optimal'
                 : (summary.recovery_score ?? 0) >= 67 ? 'Ready'
                 : 'Low',
            trend: scoreTrend.length ? scoreTrend : RECOVERY.score.trend,
          },
          hrv: {
            value: summary.hrv          ?? RECOVERY.hrv.value,
            unit:  'ms',
            avg:   summary.hrv_week_avg ?? RECOVERY.hrv.avg,
            trend: hrvTrend.length      ? hrvTrend   : RECOVERY.hrv.trend,
          },
          battery: {
            now:   summary.body_battery_wake    ?? RECOVERY.battery.now,
            max:   summary.body_battery_wake    ?? RECOVERY.battery.max,
            min:   summary.body_battery_current ?? RECOVERY.battery.min,
            trend: battTrend.length ? battTrend : RECOVERY.battery.trend,
          },
          rhr: {
            value: summary.resting_hr ?? RECOVERY.rhr.value,
            unit:  'bpm',
            avg:   RECOVERY.rhr.avg,
            trend: rhrTrend.length    ? rhrTrend   : RECOVERY.rhr.trend,
            lowerBetter: true,
          },
          stress: {
            value: summary.stress_avg ?? RECOVERY.stress.value,
            unit:  'avg',
            avg:   RECOVERY.stress.avg,
            trend: stressTrend.length ? stressTrend : RECOVERY.stress.trend,
            lowerBetter: true,
          },
          spo2: RECOVERY.spo2,
          resp: {
            value: summary.resp_avg ?? RECOVERY.resp.value,
            unit:  'br/min',
            avg:   RECOVERY.resp.avg,
            trend: respTrend.length ? respTrend : RECOVERY.resp.trend,
            lowerBetter: true,
          },
          hrvBaselineLow:  summary.hrv_baseline_low,
          hrvBaselineHigh: summary.hrv_baseline_high,
        })
      } catch {
        // keep stub data on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
