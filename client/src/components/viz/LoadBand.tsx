import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'

interface LoadBandProps {
  value: number
  low: number
  high: number
  accent: string
}

/** Horizontal load scale (200→480) with optimal zone + glowing marker. */
export function LoadBand({ value, low, high, accent }: LoadBandProps) {
  const lo = 200, hi = 480
  const pos = (x: number) =>
    `${Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100))}%`

  return (
    <div>
      <div style={{
        position: 'relative', width: '100%', height: 12,
        borderRadius: 6, background: COLORS.base,
        border: `1px solid ${COLORS.line}`, overflow: 'hidden',
      }}>
        {/* optimal zone */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: pos(low), right: `calc(100% - ${pos(high)})`,
          background: hexA(accent, 0.22),
        }} />
        {/* current marker */}
        <div style={{
          position: 'absolute', top: -2, bottom: -2,
          left: pos(value), width: 3,
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
          borderRadius: 2,
          transform: 'translateX(-50%)',
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 6,
        fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted,
      }}>
        <span>LOW</span>
        <span style={{ color: accent }}>OPTIMAL {low}–{high}</span>
        <span>HIGH</span>
      </div>
    </div>
  )
}
