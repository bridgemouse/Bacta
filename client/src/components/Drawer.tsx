import { COLORS, SECTION_ACCENTS, SECTION_LABELS, SECTION_ICONS } from '../theme'
import type { SectionKey } from '../theme'
import { DrawerItem } from './DrawerItem'

const SECTIONS: SectionKey[] = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  activeSection: string
}

export function Drawer({ isOpen, onClose, activeSection }: DrawerProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        data-testid="drawer-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 260,
          background: COLORS.surface,
          borderRight: `1px solid ${COLORS.border}`,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 16px 14px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
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
            }}
          >
            E
          </div>
          <div>
            <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>Ethan</div>
            <div style={{ color: COLORS.mx4Green, fontSize: 11 }}>● MX-4 online</div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {SECTIONS.map(section => (
            <DrawerItem
              key={section}
              section={section}
              label={SECTION_LABELS[section]}
              icon={SECTION_ICONS[section]}
              accent={SECTION_ACCENTS[section]}
              isActive={activeSection === section}
              onNavigate={onClose}
            />
          ))}
        </nav>
      </div>
    </>
  )
}
