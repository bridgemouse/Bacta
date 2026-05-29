import { COLORS, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

interface TopBarProps {
  section: SectionKey
}

export function TopBar({ section }: TopBarProps) {
  const label = section === 'home' ? 'Bacta' : SECTION_LABELS[section]
  const accent = SECTION_ACCENTS[section]

  return (
    <div
      style={{
        background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        paddingTop: 'calc(14px + env(safe-area-inset-top))',
        flexShrink: 0,
      }}
    >
      <div style={{ width: 50 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600 }}>{label}</span>
        <div data-testid="accent-bar" style={{ width: 28, height: 2, background: accent, borderRadius: 1 }} />
      </div>
      <span style={{ color: COLORS.mx4Green, fontSize: 10, whiteSpace: 'nowrap' }}>● MX-4</span>
    </div>
  )
}
