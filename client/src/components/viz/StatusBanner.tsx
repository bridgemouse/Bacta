import { COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { hexA } from '../../lib/hexA'
import { Bracket } from '../primitives/Bracket'
import { Sigil } from '../primitives/Sigil'
import { StatusCore } from '../primitives/StatusCore'

interface StatusBannerProps {
  status: string
  sub: string
  accent: string
}

/** Training status hero banner with sigil + big status word. */
export function StatusBanner({ status, sub, accent }: StatusBannerProps) {
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 15px',
      background: `linear-gradient(120deg, ${hexA(accent, 0.14)}, ${COLORS.surface} 70%)`,
      border: `1px solid ${hexA(accent, 0.4)}`,
      borderRadius: 11, overflow: 'hidden',
    }}>
      <Bracket color={accent} inset={6} op={0.4} />
      <span style={{
        flexShrink: 0, width: 40, height: 40, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hexA(accent, 0.15), border: `1px solid ${hexA(accent, 0.35)}`,
      }}>
        <Sigil name="training" color={accent} size={22} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.16em',
          color: COLORS.textMuted, marginBottom: 3,
        }}>
          TRAINING STATUS
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: FONT_UI, fontSize: 20, fontWeight: 750,
            color: accent, letterSpacing: '-0.01em',
          }}>
            {status}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary }}>
            {sub}
          </span>
        </div>
      </div>
      <StatusCore accent={accent} size={7} />
    </div>
  )
}
