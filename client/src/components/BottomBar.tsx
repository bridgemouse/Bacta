import { COLORS, FONT_MONO, FONT_UI, MX4_COLOR } from '../theme'
import type { Tab } from '../lib/TabContext'
import { MX4Sigil } from './primitives/MX4Sigil'
import { NavIcon } from './primitives/NavIcon'
import { hexA } from '../lib/hexA'

const oct = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`


function SectionTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div style={{ clipPath: oct(7), background: hexA(MX4_COLOR, 0.45), padding: 1.5, flexShrink: 0 }}>
      <div style={{ clipPath: oct(6), background: COLORS.base, display: 'flex', gap: 3, padding: 3 }}>
        {(['overview', 'trends'] as const).map(t => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => onTab(t)}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                padding: '7px 14px',
                border: 'none',
                cursor: 'pointer',
                clipPath: oct(4),
                background: active ? hexA(MX4_COLOR, 0.2) : 'transparent',
                color: active ? MX4_COLOR : COLORS.textMuted,
              }}
            >
              {t === 'overview' ? 'Overview' : 'Trends'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface BottomBarProps {
  accent: string
  hasTabs: boolean
  tab: Tab
  onTabChange: (t: Tab) => void
  onAsk: () => void
  onNav: () => void
}

const DIVIDER = (
  <span style={{ width: 1, height: 24, background: hexA(MX4_COLOR, 0.22), flexShrink: 0 }} />
)

export function BottomBar({ hasTabs, tab, onTabChange, onAsk, onNav }: BottomBarProps) {
  return (
    <div
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
        background: 'rgba(17,24,39,0.96)',
        borderTop: `1px solid ${hexA(MX4_COLOR, 0.28)}`,
        display: 'flex',
        justifyContent: 'center',
        padding: '10px 12px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Pill spans most of the dock width */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          maxWidth: 420,
          background: `linear-gradient(180deg, ${hexA(MX4_COLOR, 0.07)}, ${COLORS.surface})`,
          border: `1px solid ${hexA(MX4_COLOR, 0.3)}`,
          borderRadius: 30,
          boxShadow: `0 0 20px ${hexA(MX4_COLOR, 0.09)}, inset 0 1px 0 rgba(255,255,255,0.04)`,
          padding: '5px 8px',
        }}
      >
        {/* Ask MX-4 — always cyan, his identity anchor */}
        <button
          data-testid="ask-button"
          onClick={onAsk}
          aria-label="Ask MX-4"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: hasTabs ? 0 : 9,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${hexA(MX4_COLOR, 0.16)}, ${hexA(MX4_COLOR, 0.03)} 70%)`,
              border: `1px solid ${hexA(MX4_COLOR, 0.55)}`,
              animation: 'mx4glowbreathe 3.6s ease-in-out infinite',
              flexShrink: 0,
            }}
          >
            <MX4Sigil color={MX4_COLOR} size={29} glow mood="listen" />
          </span>
          {!hasTabs && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingRight: 4 }}>
              <span style={{ fontFamily: FONT_UI, fontSize: 13, fontWeight: 650, color: COLORS.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                Ask MX-4
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.12em', color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
                TAP TO TALK
              </span>
            </span>
          )}
        </button>

        {DIVIDER}

        {/* Center — tabs or flex spacer */}
        {hasTabs ? (
          <>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <SectionTabs tab={tab} onTab={onTabChange} />
            </div>
            {DIVIDER}
          </>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Nav */}
        <button
          data-testid="nav-button"
          onClick={onNav}
          aria-label="All Systems"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${hexA(COLORS.textSecondary, 0.1)}, transparent 70%)`,
            border: `1px solid ${hexA(COLORS.textSecondary, 0.45)}`,
            boxShadow: `0 0 11px ${hexA(COLORS.textSecondary, 0.22)}, inset 0 0 7px ${hexA(COLORS.textSecondary, 0.06)}`,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <NavIcon color={COLORS.textSecondary} size={26} />
        </button>
      </div>
    </div>
  )
}
