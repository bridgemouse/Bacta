import { COLORS, FONT_MONO } from '../../theme'
import { Sparkline } from '../primitives/Sparkline'
import { Delta } from './Delta'

interface VitalTileProps {
  label: string
  value: string | number
  unit?: string
  data?: number[]
  accent: string
  delta?: number
  lowerBetter?: boolean
}

/** Compact secondary metric tile with optional sparkline. */
export function VitalTile({ label, value, unit, data, accent, delta, lowerBetter }: VitalTileProps) {
  return (
    <div style={{
      position: 'relative', background: COLORS.surface,
      border: `1px solid ${COLORS.line}`, borderRadius: 8,
      padding: '10px 11px 9px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: COLORS.textMuted, fontWeight: 600,
        }}>
          {label}
        </span>
        {delta !== undefined && <Delta value={delta} lowerBetter={lowerBetter} size={8.5} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{unit}</span>
        )}
      </div>
      {data && <Sparkline data={data} accent={accent} w={120} h={18} sw={1.5} dot={false} fill={false} />}
    </div>
  )
}
