import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'

interface IntensityBarProps {
  moderate: number
  vigorous: number
  goal: number
  accent: string
}

/** Stacked moderate + vigorous bar toward weekly goal. Vigorous counts double. */
export function IntensityBar({ moderate, vigorous, goal, accent }: IntensityBarProps) {
  const weighted = moderate + vigorous * 2  // Garmin weighting
  const scale = Math.max(weighted, goal) * 1.05

  return (
    <div>
      <div style={{
        position: 'relative', width: '100%', height: 14,
        borderRadius: 7, background: COLORS.base,
        border: `1px solid ${COLORS.line}`, overflow: 'hidden', display: 'flex',
      }}>
        <div style={{ width: `${(moderate / scale) * 100}%`, background: hexA(accent, 0.45) }} />
        <div style={{
          width: `${(vigorous * 2 / scale) * 100}%`,
          background: accent,
          boxShadow: `0 0 8px ${hexA(accent, 0.5)}`,
        }} />
        {/* goal marker */}
        <span style={{
          position: 'absolute', top: -1, bottom: -1,
          left: `${(goal / scale) * 100}%`,
          width: 2, background: COLORS.text, opacity: 0.7,
        }} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 9 }}>
        {([['Moderate', moderate, hexA(accent, 0.5)], ['Vigorous', vigorous, accent]] as const).map(([l, v, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary }}>
              {l} <span style={{ color: COLORS.text, fontWeight: 600 }}>{v}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
