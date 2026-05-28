import { useState } from 'react'
import { COLORS, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'
import { SubNav } from './SubNav'
import { MX4Card, type MX4Insight } from './MX4Card'

interface PageShellProps {
  section: SectionKey
  tabs: string[]
  /** Pass null to show loading state. Omit entirely to hide the MX-4 card (e.g. Daily Log). */
  insight?: MX4Insight | null
  isGenerating?: boolean
  onMenuOpen: () => void
  children: React.ReactNode
}

export function PageShell({
  section,
  tabs,
  insight,
  isGenerating,
  onMenuOpen,
  children,
}: PageShellProps) {
  const [activeTab, setActiveTab] = useState(tabs[0] ?? '')
  const accent = SECTION_ACCENTS[section]
  const label = SECTION_LABELS[section]

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: COLORS.base,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          paddingTop: 'calc(14px + env(safe-area-inset-top))',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
        }}
      >
        <button
          data-testid="menu-button"
          onClick={onMenuOpen}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textSecondary,
            fontSize: 20,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ☰
        </button>
        <span style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600 }}>
          {label}
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}>
        {tabs.length > 1 && (
          <SubNav tabs={tabs} active={activeTab} accent={accent} onChange={setActiveTab} />
        )}
        {insight !== undefined && (
          <MX4Card insight={insight} section={section} isGenerating={isGenerating} />
        )}
        {children}
      </div>
    </div>
  )
}
