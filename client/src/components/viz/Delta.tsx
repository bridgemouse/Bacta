import { COLORS, FONT_MONO } from '../../theme'

interface DeltaProps {
  value: number | null | undefined
  unit?: string
  lowerBetter?: boolean
  size?: number
}

/** ▲/▼ change badge. lowerBetter inverts the good/bad color. */
export function Delta({ value, unit = '', lowerBetter = false, size = 10 }: DeltaProps) {
  if (value === 0 || value == null) {
    return (
      <span style={{ fontFamily: FONT_MONO, fontSize: size, color: COLORS.textMuted, letterSpacing: '0.02em' }}>
        ±0{unit}
      </span>
    )
  }
  const up = value > 0
  const good = lowerBetter ? !up : up
  const color = good ? COLORS.green : COLORS.red
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontFamily: FONT_MONO, fontSize: size,
      color, fontWeight: 600, letterSpacing: '0.02em',
    }}>
      <span style={{ fontSize: size - 1 }}>{up ? '▲' : '▼'}</span>
      {Math.abs(value)}{unit}
    </span>
  )
}
