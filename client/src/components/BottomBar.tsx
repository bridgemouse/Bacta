import { COLORS, FONT_MONO, FONT_UI } from '../theme'
import { MX4Sigil } from './primitives/MX4Sigil'
import { NavIcon } from './primitives/NavIcon'
import { hexA } from '../lib/hexA'

interface BottomBarProps {
  accent: string
  onAsk: () => void
  onNav: () => void
}

export function BottomBar({ accent, onAsk, onNav }: BottomBarProps) {
  const circleBase = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    border: 'none',
    padding: 0,
  }

  return (
    <div
      style={{
        background: 'rgba(17,24,39,0.92)',
        borderTop: `1px solid ${hexA(accent, 0.28)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        paddingLeft: 18,
        paddingRight: 18,
        paddingBottom: `env(safe-area-inset-bottom, 10px)`,
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Ask MX-4 button (left) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <button
          data-testid="ask-button"
          onClick={onAsk}
          aria-label="Ask MX-4"
          style={{
            ...circleBase,
            background: `radial-gradient(circle, ${hexA(accent, 0.13)}, ${hexA(accent, 0.03)} 70%)`,
            border: `1px solid ${hexA(accent, 0.55)}`,
            animation: 'mx4glowbreathe 3.6s ease-in-out infinite',
          }}
        >
          <MX4Sigil color={accent} size={28} glow mood="listen" />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 13.5, fontWeight: 650, color: COLORS.text }}>
            Ask MX-4
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.12em', color: COLORS.textMuted }}>
            TAP TO TALK
          </span>
        </div>
      </div>

      {/* Nav button (right) */}
      <button
        data-testid="nav-button"
        onClick={onNav}
        aria-label="All Systems"
        style={{
          ...circleBase,
          background: COLORS.base,
          border: `1px solid ${COLORS.line}`,
        }}
      >
        <NavIcon color={COLORS.textSecondary} size={26} />
      </button>
    </div>
  )
}
