// client/src/components/StatGrid.tsx
import { StatTile } from './StatTile'
import type { GarminSummary } from '../api'

type Props = {
  summary: GarminSummary
}

function formatSleep(minutes: number | undefined): string | undefined {
  if (minutes === undefined) return undefined
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}.${Math.round(m / 6)}h`
}

export function StatGrid({ summary }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile
        label="RECOVERY"
        value={summary.recovery_score}
        color="#34d399"
      />
      <StatTile
        label="HRV"
        value={summary.hrv}
        unit="ms"
        color="#60a5fa"
      />
      <StatTile
        label="SLEEP"
        value={formatSleep(summary.sleep_duration)}
        color="#a78bfa"
      />
      <StatTile
        label="BATTERY"
        value={summary.body_battery}
        color="#f59e0b"
      />
      <StatTile
        label="STRESS"
        value={summary.stress_score}
        color="#fb7185"
      />
      <StatTile
        label="VO2 MAX"
        value={summary.vo2max}
        color="#818cf8"
      />
    </div>
  )
}
