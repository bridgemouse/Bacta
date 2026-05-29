import { useState } from 'react'
import { COLORS, SECTION_ACCENTS } from '../theme'
import type { SectionKey } from '../theme'
import { TopBar } from './TopBar'
import { BottomBar } from './BottomBar'
import { BottomSheet } from './BottomSheet'

interface AppShellProps {
  section: SectionKey
  tabs?: string[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  children: React.ReactNode
}

export function AppShell({ section, tabs, activeTab, onTabChange, children }: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.base,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopBar section={section} />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'none',
          padding: '14px 16px',
        }}
      >
        {children}
      </div>
      <BottomBar
        tabs={tabs}
        activeTab={activeTab}
        accent={SECTION_ACCENTS[section]}
        onTabChange={onTabChange}
        onMenuOpen={() => setSheetOpen(true)}
      />
      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        activeSection={section}
      />
    </div>
  )
}
