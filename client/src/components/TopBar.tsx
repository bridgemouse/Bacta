import { COLORS, FONT_MONO, MX4_COLOR, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

const oct = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`
import { MX4Sigil } from './primitives/MX4Sigil'
import { Sigil } from './primitives/Sigil'
import { StatusCore } from './primitives/StatusCore'
import { hexA } from '../lib/hexA'
import { useSyncState } from '../hooks/useSyncState'

interface TopBarProps {
  section: SectionKey
  onBack?: () => void
}

const GARMIN_SECTIONS: SectionKey[] = ['home', 'recovery', 'sleep', 'training']

export function TopBar({ section, onBack }: TopBarProps) {
  const isHome = section === 'home'
  const accent = isHome ? MX4_COLOR : SECTION_ACCENTS[section]
  const showSync = GARMIN_SECTIONS.includes(section)
  const { status, elapsed, startSync } = useSyncState()

  const syncLabel =
    status === 'running' ? `${elapsed ?? 0}s` :
    status === 'done'    ? 'SYNCED' :
    status === 'error'   ? 'ERROR' :
    'SYNC'

  const syncColor =
    status === 'error' ? COLORS.mx4Red :
    status === 'done'  ? COLORS.mx4Green :
    accent

  return (
    <div
      style={{
        background: 'rgba(17,24,39,0.92)',
        borderBottom: `1px solid ${hexA(accent, 0.28)}`,
        boxShadow: `0 1px 0 ${hexA(accent, 0.12)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: `max(10px, env(safe-area-inset-top))`,
        paddingBottom: 10,
        paddingLeft: 16,
        paddingRight: 16,
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Left side */}
      {isHome ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <MX4Sigil color={accent} size={18} spin mood="idle" />
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>
            BACTA
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: '0.14em', color: COLORS.textMuted }}>
            ·OS
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <button
            aria-label="Back"
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center', color: accent,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <Sigil name={section as Exclude<SectionKey, 'home'>} color={accent} size={16} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', color: accent }}>
            {SECTION_LABELS[section].toUpperCase()}
          </span>
        </div>
      )}

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {showSync && (
          <div style={{ clipPath: oct(5), background: hexA(syncColor, status === 'idle' ? 0.3 : 0.55), padding: 1, flexShrink: 0 }}>
            <button
              onClick={startSync}
              aria-label="Sync Garmin data"
              disabled={status === 'running'}
              style={{
                clipPath: oct(4),
                display: 'flex', alignItems: 'center', gap: 5,
                background: status === 'idle' ? COLORS.surface : hexA(syncColor, 0.12),
                border: 'none', padding: '4px 9px 4px 6px',
                cursor: status === 'running' ? 'default' : 'pointer',
              }}
            >
              <div style={{
                width: 11, height: 11, flexShrink: 0,
                animation: status === 'running' ? 'mx4spin 1s linear infinite' : 'none',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke={syncColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.1em', color: syncColor, whiteSpace: 'nowrap' }}>
                {syncLabel}
              </span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <StatusCore accent={COLORS.mx4Green} size={6} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: COLORS.mx4Green }}>
            MX-4 ONLINE
          </span>
        </div>
      </div>
    </div>
  )
}
