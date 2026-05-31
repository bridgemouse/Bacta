import { FONT_MONO } from '../../theme'
import type { SleepStage } from '../../lib/stubData'

interface StageSplitProps {
  stages: SleepStage[]
}

/** Proportional horizontal bar of sleep stages with % labels inside wide segments. */
export function StageSplit({ stages }: StageSplitProps) {
  const total = stages.reduce((a, s) => a + s.mins, 0)
  return (
    <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
      {stages.map(s => (
        <div key={s.key} style={{
          width: `${(s.mins / total) * 100}%`,
          background: s.color,
          opacity: s.key === 'awake' ? 0.45 : 1,
          borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {s.pct >= 18 && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: '#0b0d12' }}>
              {s.pct}%
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
