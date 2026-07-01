import { useNavigate } from 'react-router-dom'
import { COLORS, FONT_MONO, MX4_COLOR, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'
import { Sheet, SheetShell, SheetHeader } from './Sheet'
import { MX4Sigil } from './primitives/MX4Sigil'
import { Sigil } from './primitives/Sigil'
import { NavIcon } from './primitives/NavIcon'
import { Bracket } from './primitives/Bracket'
import { FTelemetry } from './primitives/FTelemetry'
import { hexA } from '../lib/hexA'

const SECTION_KEYS: Exclude<SectionKey, 'home'>[] = [
  'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog',
]

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  currentSection: SectionKey
}

export function BottomSheet({ open, onClose, currentSection }: BottomSheetProps) {
  const navigate = useNavigate()

  const handleNav = (section: SectionKey) => {
    navigate(section === 'home' ? '/' : `/${section}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} maxHeight="86%">
      <SheetShell accent={MX4_COLOR} onClose={onClose}>
        <SheetHeader
          accent={MX4_COLOR}
          title="ALL SYSTEMS"
          sub="SELECT A CHANNEL"
          sigil={<NavIcon color={MX4_COLOR} size={26} />}
          onClose={onClose}
        />

        <div style={{ position: 'relative', overflowY: 'auto', padding: '2px 16px 0' }}>
          {/* Home · Overview row */}
          <button
            onClick={() => handleNav('home')}
            style={{
              width: '100%',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: currentSection === 'home' ? hexA(MX4_COLOR, 0.08) : COLORS.surface,
              border: `1px solid ${currentSection === 'home' ? hexA(MX4_COLOR, 0.45) : COLORS.line}`,
              borderRadius: 12,
              padding: '13px 14px',
              marginBottom: 14,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hexA(MX4_COLOR, 0.12),
                border: `1px solid ${hexA(MX4_COLOR, 0.3)}`,
              }}
            >
              <MX4Sigil color={MX4_COLOR} size={24} mood="idle" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.text }}>Home · Overview</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>
                6 systems nominal
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MX4_COLOR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,5 16,12 9,19" />
            </svg>
          </button>

          {/* CHANNELS divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.18em', color: COLORS.textMuted }}>
              CHANNELS
            </span>
            <span style={{ flex: 1, height: 1, background: COLORS.line }} />
          </div>

          {/* 6 section channels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4 }}>
            {SECTION_KEYS.map((key) => {
              const accent = SECTION_ACCENTS[key]
              const active = currentSection === key
              return (
                <button
                  key={key}
                  onClick={() => handleNav(key)}
                  style={{
                    position: 'relative',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    background: active ? hexA(accent, 0.09) : COLORS.surface,
                    border: `1px solid ${active ? hexA(accent, 0.5) : COLORS.line}`,
                    borderRadius: 11,
                    padding: '13px 12px 12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: `linear-gradient(90deg, ${accent}, transparent 80%)`,
                      opacity: 0.9,
                    }}
                  />
                  <Bracket color={accent} inset={6} op={0.45} radius={4} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: hexA(accent, 0.13),
                        border: `1px solid ${hexA(accent, 0.32)}`,
                      }}
                    >
                      <Sigil name={key} color={accent} size={17} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 650, color: COLORS.text, lineHeight: 1.1 }}>
                      {SECTION_LABELS[key]}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* SYSTEM divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.18em', color: COLORS.textMuted }}>
              SYSTEM
            </span>
            <span style={{ flex: 1, height: 1, background: COLORS.line }} />
          </div>

          {/* Settings / Configuration */}
          <button
            onClick={() => { navigate('/settings'); onClose() }}
            style={{
              width: '100%',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: COLORS.surface,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 10,
              padding: '11px 14px',
              marginBottom: 4,
            }}
          >
            <span style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: hexA(MX4_COLOR, 0.1),
              border: `1px solid ${hexA(MX4_COLOR, 0.25)}`,
            }}>
              <Sigil name="settings" color={MX4_COLOR} size={16} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 650, color: COLORS.text }}>Configuration</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textSecondary, marginTop: 2 }}>
                API KEYS · MODELS · SCHEDULE
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={COLORS.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,5 16,12 9,19" />
            </svg>
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '13px 18px 26px',
            borderTop: `1px solid ${COLORS.line}`,
            marginTop: 12,
          }}
        >
          <MX4Sigil color={MX4_COLOR} size={17} spin mood="idle" />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: COLORS.textSecondary }}>
            WHERE TO, COMMANDER?
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <FTelemetry color={MX4_COLOR} bars={4} />
          </span>
        </div>
      </SheetShell>
    </Sheet>
  )
}
