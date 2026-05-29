import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { COLORS } from '../theme'
import type { SectionKey } from '../theme'
import { TopBar } from './TopBar'
import { BottomBar, type BottomAction } from './BottomBar'
import { BottomSheet } from './BottomSheet'

export type { BottomAction }

interface AppShellProps {
  section: SectionKey
  actions?: BottomAction[]
  children: React.ReactNode
}

export function AppShell({ section, actions = [], children }: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { pathname } = useLocation()
  const activeSection = (pathname.split('/').filter(Boolean)[0] ?? 'home') as SectionKey

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
      <BottomBar actions={actions} onMenuOpen={() => setSheetOpen(true)} />
      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        activeSection={activeSection}
      />
    </div>
  )
}
