import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'
import { Sparkline } from '../primitives/Sparkline'
import { Bars7 } from './Bars7'
import { Delta } from './Delta'

interface TrendRowProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  data: number[]
  accent: string
  delta?: number
  lowerBetter?: boolean
  kind?: 'spark' | 'bars'
  fmt?: (v: number) => string
}

/** Trends-tab row: label/value/delta left, sparkline or bar chart right. */
export function TrendRow({ label, value, unit, sub, data, accent, delta, lowerBetter, kind = 'spark', fmt }: TrendRowProps) {
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
      background: COLORS.surface, border: `1px solid ${COLORS.line}`,
      borderRadius: 9, padding: '11px 13px', overflow: 'hidden',
    }}>
      <span style={{
        position: 'absolute', top: 0, bottom: 0, left: 0,
        width: 2, background: accent, opacity: 0.7,
      }} />
      <div style={{ minWidth: 84, flexShrink: 0 }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 600,
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{unit}</span>
          )}
        </div>
        {(delta !== undefined || sub) && (
          <div style={{ marginTop: 4 }}>
            {delta !== undefined
              ? <Delta value={delta} lowerBetter={lowerBetter} size={9} />
              : <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{sub}</span>}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kind === 'bars'
          ? <Bars7 data={data} accent={accent} h={42} fmt={fmt} />
          : <Sparkline data={data} accent={accent} w={180} h={42} sw={1.8} />}
      </div>
    </div>
  )
}
