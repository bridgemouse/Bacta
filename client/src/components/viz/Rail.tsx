import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'

interface RailProps {
  label: string
  accent: string
  right?: string
}

/** Section divider rail — accent label + gradient line + optional right meta. */
export function Rail({ label, accent, right }: RailProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '16px 0 11px' }}>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.2em',
        color: accent, fontWeight: 600, flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        flex: 1, height: 1,
        background: `linear-gradient(90deg, ${hexA(accent, 0.4)}, ${COLORS.line})`,
      }} />
      {right && (
        <span style={{
          fontFamily: FONT_MONO, fontSize: 9,
          color: COLORS.textMuted, letterSpacing: '0.06em', flexShrink: 0,
        }}>
          {right}
        </span>
      )}
    </div>
  )
}
