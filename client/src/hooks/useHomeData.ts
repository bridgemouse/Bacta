import { useState, useEffect } from 'react'
import { fetchSummary, TRAINING_STATUS } from '../lib/garminApi'

interface HomeTileData {
  recovery: { value: string; sub: string }
  training: { value: string; sub: string }
  sleep:    { value: string; sub: string; ring: number }
}

const STUB: HomeTileData = {
  recovery: { value: '74', sub: 'HRV ↑ 61ms' },
  training: { value: '342', sub: 'Moderate · wk 4 / 8' },
  sleep:    { value: '8.1', sub: 'Score 82', ring: 0.82 },
}

export function useHomeData(): { data: HomeTileData; loading: boolean } {
  const [data, setData] = useState<HomeTileData>(STUB)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const s = await fetchSummary()
        if (cancelled) return

        const deepS  = s.sleep_deep_s  ?? 0
        const lightS = s.sleep_light_s ?? 0
        const remS   = s.sleep_rem_s   ?? 0
        const totalMins = Math.round((deepS + lightS + remS) / 60)
        const sleepH = Math.floor(totalMins / 60)
        const sleepM = totalMins % 60
        const sleepStr = totalMins > 0
          ? sleepM > 0 ? `${sleepH}h ${sleepM}m` : `${sleepH}h`
          : STUB.sleep.value
        const sleepScore = s.sleep_score ?? 82

        const statusN = s.training_status_n ?? null
        const statusLabel = statusN != null
          ? (TRAINING_STATUS[Math.round(statusN)] ?? 'Maintaining')
          : 'On track'

        const hrv = s.hrv
        const hrvAvg = s.hrv_week_avg
        const hrvSub = hrv != null
          ? `HRV ${hrv > (hrvAvg ?? hrv) ? '↑' : '↓'} ${hrv}ms`
          : STUB.recovery.sub

        setData({
          recovery: {
            value: String(s.body_battery_wake ?? 74),
            sub:   hrvSub,
          },
          training: {
            value: String(Math.round(s.training_load ?? 342)),
            sub:   statusLabel,
          },
          sleep: {
            value: sleepStr,
            sub:   `Score ${sleepScore}`,
            ring:  sleepScore / 100,
          },
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
