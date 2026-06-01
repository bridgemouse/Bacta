import { useState, useRef } from 'react'
import { COLORS, FONT_MONO, MX4_COLOR, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'
import { MX4Sigil } from './primitives/MX4Sigil'
import { Sigil } from './primitives/Sigil'
import { StatusCore } from './primitives/StatusCore'
import { hexA } from '../lib/hexA'

interface TopBarProps {
  section: SectionKey
  onBack?: () => void
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error'

export function TopBar({ section, onBack }: TopBarProps) {
  const isHome = section === 'home'
  const accent = isHome ? MX4_COLOR : SECTION_ACCENTS[section]
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSync() {
    if (syncState === 'syncing') return
    setSyncState('syncing')
    try {
      await fetch('/api/garmin/sync', { method: 'POST' })
      setSyncState('done')
      // Reload after 45s to pick up fresh data (poller takes ~30-45s)
      reloadTimer.current = setTimeout(() => window.location.reload(), 45_000)
    } catch {
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 3000)
    }
  }

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
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: accent,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isHome && (
          <button
            onClick={handleSync}
            aria-label="Sync Garmin data"
            title={syncState === 'syncing' ? 'Syncing… reloads in ~45s' : syncState === 'done' ? 'Syncing — will reload' : 'Sync Garmin data'}
            style={{
              background: 'none', border: 'none', padding: 2, cursor: syncState === 'syncing' ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', opacity: syncState === 'idle' ? 0.55 : 1,
            }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={syncState === 'error' ? COLORS.mx4Red : syncState === 'done' ? COLORS.mx4Green : accent}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: syncState === 'syncing' ? 'mx4spin 1s linear infinite' : 'none' }}
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
            </svg>
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusCore accent={COLORS.mx4Green} size={6} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: COLORS.mx4Green }}>
            {syncState === 'syncing' ? 'SYNCING' : syncState === 'done' ? 'SYNCED' : 'MX-4 ONLINE'}
          </span>
        </div>
      </div>
    </div>
  )
}
