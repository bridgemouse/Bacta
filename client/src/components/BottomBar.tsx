import { COLORS } from '../theme'

export interface BottomAction {
  icon: string
  label: string
  onClick: () => void
}

interface BottomBarProps {
  actions: BottomAction[]
  onMenuOpen: () => void
}

export function BottomBar({ actions, onMenuOpen }: BottomBarProps) {
  return (
    <div
      style={{
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 20px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 28 }}>
        {actions.map(({ icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: 4,
            }}
          >
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>{label}</span>
          </button>
        ))}
      </div>
      <button
        data-testid="menu-button"
        onClick={onMenuOpen}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: 4,
        }}
      >
        <span style={{ fontSize: 20, color: COLORS.textSecondary }}>☰</span>
        <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>Menu</span>
      </button>
    </div>
  )
}
