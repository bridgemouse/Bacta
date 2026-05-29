import { useNavigate } from 'react-router-dom'
import { COLORS, SECTION_ACCENTS, SECTION_LABELS, SECTION_ICONS } from '../theme'
import type { SectionKey } from '../theme'

const SECTIONS: SectionKey[] = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  activeSection: SectionKey
}

export function BottomSheet({ isOpen, onClose, activeSection }: BottomSheetProps) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleNav = (section: SectionKey) => {
    navigate(section === 'home' ? '/' : `/${section}`)
    onClose()
  }

  return (
    <>
      <div
        data-testid="bottom-sheet-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 40,
        }}
      />
      <div
        data-testid="bottom-sheet"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: COLORS.surface,
          borderRadius: '14px 14px 0 0',
          borderTop: `1px solid ${COLORS.border}`,
          zIndex: 50,
        }}
      >
        {/* Handle */}
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 3, background: COLORS.textMuted, borderRadius: 2, margin: '0 auto' }} />
        </div>

        {/* Profile header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4ade80, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            E
          </div>
          <div>
            <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>Ethan</div>
            <div style={{ color: COLORS.mx4Green, fontSize: 11 }}>● MX-4 online</div>
          </div>
        </div>

        {/* Section nav */}
        <nav style={{ padding: '8px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
          {SECTIONS.map(section => {
            const isActive = activeSection === section
            const accent = SECTION_ACCENTS[section]
            return (
              <button
                key={section}
                onClick={() => handleNav(section)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 12px',
                  background: isActive ? accent + '18' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 16 }}>{SECTION_ICONS[section]}</span>
                <span
                  style={{
                    color: isActive ? accent : COLORS.textSecondary,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {SECTION_LABELS[section]}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
