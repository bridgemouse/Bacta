import { useState, useEffect } from 'react'
import { fetchSummary, fetchTrend } from '../lib/garminApi'
import { RECOVERY } from '../lib/stubData'

const arrAvg = (a: number[]) =>
  a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

function linearRegressionSlope(data: number[]): number {
  const n = data.length
  if (n < 2) return 0
  const sumX = (n * (n - 1)) / 2
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = data.reduce((s, v) => s + v, 0)
  const sumXY = data.reduce((s, v, i) => s + i * v, 0)
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
}

export type HrvDirection = {
  slope: number
  direction: 'up' | 'stable' | 'down'
  label: string
  sub: string
}

export type RecoveryData = Omit<typeof RECOVERY, 'spo2' | 'hrv'> & {
  hrv: {
    value: number
    unit: string
    avg: number | null
    trend: number[]
    direction: HrvDirection | null
  }
  spo2: { value: number | null; unit: string; avg: number | null; trend: number[] }
  hrvBaselineLow?: number
  hrvBaselineHigh?: number
  stressLabel?: string
  stressMax?: number
  stressMaxTrend: number[]
  respMax?: number
  batteryConsumed?: number
}

const INITIAL: RecoveryData = {
  ...RECOVERY,
  hrv: { ...RECOVERY.hrv, direction: null },
  spo2: { value: null, unit: '%', avg: null, trend: [] },
  stressMaxTrend: [],
}

export function useRecoveryData(): { data: RecoveryData; loading: boolean } {
  const [data, setData] = useState<RecoveryData>(INITIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summary, hrvTrend, rhrTrend, battTrend, stressTrend, respTrend, scoreTrend, stressMaxTrend] =
          await Promise.all([
            fetchSummary(),
            fetchTrend('hrv'),
            fetchTrend('resting_hr'),
            fetchTrend('body_battery_wake'),
            fetchTrend('stress_avg'),
            fetchTrend('resp_avg'),
            fetchTrend('recovery_score'),
            fetchTrend('stress_max'),
          ])
        if (cancelled) return

        const stressAvg = summary.stress_avg ?? RECOVERY.stress.value
        const stressLabel =
          stressAvg < 26 ? 'LOW' :
          stressAvg < 51 ? 'MODERATE' :
          stressAvg < 76 ? 'HIGH' : 'VERY HIGH'

        const wake = summary.body_battery_wake
        const current = summary.body_battery_current
        const batteryConsumed = wake != null && current != null
          ? Math.max(0, wake - current)
          : undefined

        const trendForDir = hrvTrend.length ? hrvTrend : RECOVERY.hrv.trend
        const slope = linearRegressionSlope(trendForDir)
        const roundedSlope = Math.round(slope * 10) / 10
        const direction: HrvDirection = {
          slope: roundedSlope,
          direction: slope > 0.3 ? 'up' : slope < -0.3 ? 'down' : 'stable',
          label: slope > 0.3 ? '↑ IMPROVING' : slope < -0.3 ? '↓ DECLINING' : '→ STABLE',
          sub: `${roundedSlope >= 0 ? '+' : ''}${roundedSlope.toFixed(1)} ms/day`,
        }

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
            trend: hrvTrend.length      ? hrvTrend : RECOVERY.hrv.trend,
            direction: trendForDir.length >= 2 ? direction : null,
          },
          battery: {
            now:   summary.body_battery_current ?? RECOVERY.battery.now,
            max:   summary.body_battery_wake    ?? RECOVERY.battery.max,
            min:   0,
            trend: battTrend.length ? battTrend : RECOVERY.battery.trend,
          },
          rhr: {
            value: summary.resting_hr ?? RECOVERY.rhr.value,
            unit:  'bpm',
            avg:   arrAvg(rhrTrend)   ?? RECOVERY.rhr.avg,
            trend: rhrTrend.length    ? rhrTrend : RECOVERY.rhr.trend,
            lowerBetter: true,
          },
          stress: {
            value: stressAvg,
            unit:  'avg',
            avg:   arrAvg(stressTrend) ?? RECOVERY.stress.avg,
            trend: stressTrend.length  ? stressTrend : RECOVERY.stress.trend,
            lowerBetter: true,
          },
          spo2: {
            value: summary.spo2_avg ?? null,
            unit:  '%',
            avg:   summary.spo2_avg ?? null,
            trend: [],
          },
          resp: {
            value: summary.resp_avg ?? RECOVERY.resp.value,
            unit:  'br/min',
            avg:   arrAvg(respTrend) ?? RECOVERY.resp.avg,
            trend: respTrend.length  ? respTrend : RECOVERY.resp.trend,
            lowerBetter: true,
          },
          hrvBaselineLow:  summary.hrv_baseline_low,
          hrvBaselineHigh: summary.hrv_baseline_high,
          stressLabel,
          stressMax:      summary.stress_max,
          stressMaxTrend: stressMaxTrend.length ? stressMaxTrend : [],
          respMax:        summary.resp_max,
          batteryConsumed,
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
