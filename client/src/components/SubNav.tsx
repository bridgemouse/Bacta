import { COLORS } from '../theme'

interface SubNavProps {
  tabs: string[]
  active: string
  accent: string
  onChange: (tab: string) => void
}

export function SubNav({ tabs, active, accent, onChange }: SubNavProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 2,
        scrollbarWidth: 'none',
        marginBottom: 14,
      }}
    >
      {tabs.map(tab => {
        const isActive = tab === active
        return (
          <button
            key={tab}
            data-active={isActive}
            onClick={() => onChange(tab)}
            style={{
              flexShrink: 0,
              background: isActive ? accent + '22' : 'transparent',
              border: `1px solid ${isActive ? accent : COLORS.border}`,
              borderRadius: 20,
              padding: '5px 12px',
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
  )
}
