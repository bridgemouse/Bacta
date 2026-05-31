import { COLORS, FONT_MONO } from '../../theme'
import type { SleepStage } from '../../lib/stubData'

interface StageLegendProps {
  stages: SleepStage[]
}

/** Color swatch + name + duration + % for each sleep stage. */
export function StageLegend({ stages }: StageLegendProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 14px' }}>
      {stages.map(s => (
        <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 9, height: 9, borderRadius: 2,
            background: s.color, opacity: s.key === 'awake' ? 0.5 : 1,
          }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textSecondary }}>
            {s.label}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.text, fontWeight: 600 }}>
            {Math.floor(s.mins / 60)}h {String(s.mins % 60).padStart(2, '0')}m
          </span>
          {s.key !== 'awake' && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
              {s.pct}%
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
