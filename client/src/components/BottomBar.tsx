import { COLORS } from '../theme'

interface BottomBarProps {
  tabs?: string[]
  activeTab?: string
  accent?: string // must be a 6-digit hex string e.g. "#64b5f6" — appended with "22" for the active tint
  onTabChange?: (tab: string) => void
  onMenuOpen: () => void
}

export function BottomBar({ tabs, activeTab, accent = COLORS.textSecondary, onTabChange, onMenuOpen }: BottomBarProps) {
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
      <div style={{ display: 'flex', gap: 6 }}>
        {(tabs ?? []).map(tab => {
          const isActive = tab === activeTab
          return (
            <button
              key={tab}
              data-active={isActive}
              onClick={() => onTabChange?.(tab)}
              style={{
                background: isActive ? accent + '22' : 'transparent',
                border: `1px solid ${isActive ? accent : COLORS.border}`,
                borderRadius: 20,
                padding: '5px 14px',
                color: isActive ? accent : COLORS.textSecondary,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab}
            </button>
          )
        })}
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
