import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR } from '../theme'
import type { Tab } from '../lib/TabContext'
import { MX4Sigil } from './primitives/MX4Sigil'
import { NavIcon } from './primitives/NavIcon'
import { hexA } from '../lib/hexA'

// ── Section tab toggle (always MX-4 cyan) ────────────────────────────────────
function SectionTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {(['overview', 'trends'] as const).map(t => {
        const active = tab === t
        return (
          <button
            key={t}
            onClick={() => onTab(t)}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '5px 12px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              background: active ? MX4_COLOR : 'transparent',
              color: active ? '#0b0d12' : COLORS.textMuted,
              fontWeight: active ? 700 : 500,
              transition: 'background 0.18s, color 0.18s',
            }}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface BottomBarProps {
  accent: string
  hasTabs: boolean
  tab: Tab
  onTabChange: (t: Tab) => void
  onAsk: () => void
  onNav: () => void
}

const DIVIDER = (
  <span style={{ width: 1, height: 22, background: hexA(MX4_COLOR, 0.22), flexShrink: 0 }} />
)

export function BottomBar({ accent, hasTabs, tab, onTabChange, onAsk, onNav }: BottomBarProps) {
  const circleBtn: React.CSSProperties = {
    width: 40,
    height: 40,
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
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        padding: '8px 16px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15,17,23,0.94)',
          border: `1px solid ${hexA(MX4_COLOR, 0.28)}`,
          borderRadius: 30,
          boxShadow: `0 0 20px ${hexA(MX4_COLOR, 0.09)}, 0 2px 16px rgba(0,0,0,0.5)`,
          padding: '5px 10px',
        }}
      >
        {/* Ask MX-4 */}
        <button
          data-testid="ask-button"
          onClick={onAsk}
          aria-label="Ask MX-4"
          style={{
            ...circleBtn,
            background: `radial-gradient(circle, ${hexA(accent, 0.14)}, ${hexA(accent, 0.04)} 70%)`,
            border: `1px solid ${hexA(accent, 0.5)}`,
            animation: 'mx4glowbreathe 3.6s ease-in-out infinite',
          }}
        >
          <MX4Sigil color={accent} size={26} glow mood="listen" />
        </button>

        {/* Label when no tabs (home or stub pages) */}
        {!hasTabs && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingRight: 4 }}>
            <span style={{ fontFamily: FONT_UI, fontSize: 13, fontWeight: 650, color: COLORS.text, lineHeight: 1 }}>
              Ask MX-4
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: '0.12em', color: COLORS.textMuted }}>
              TAP TO TALK
            </span>
          </div>
        )}

        {DIVIDER}

        {/* Section tabs */}
        {hasTabs && (
          <>
            <SectionTabs tab={tab} onTab={onTabChange} />
            {DIVIDER}
          </>
        )}

        {/* Nav */}
        <button
          data-testid="nav-button"
          onClick={onNav}
          aria-label="All Systems"
          style={{
            ...circleBtn,
            background: hexA(COLORS.line, 0.5),
            border: `1px solid ${COLORS.line}`,
          }}
        >
          <NavIcon color={COLORS.textSecondary} size={24} />
        </button>
      </div>
    </div>
  )
}
