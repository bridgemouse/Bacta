import { useState } from 'react'
import { COLORS, MX4_COLOR, SECTION_ACCENTS } from '../theme'
import type { SectionKey } from '../theme'
import { TabContext } from '../lib/TabContext'
import type { Tab } from '../lib/TabContext'
import { TopBar } from './TopBar'
import { BottomBar } from './BottomBar'
import { BottomSheet } from './BottomSheet'
import { AskSheet } from './AskSheet'
import { bactaTexture } from '../lib/bactaTexture'
import { AskSheetContext } from '../lib/AskSheetContext'
import { useTransitionNavigate } from '../lib/useTransitionNavigate'

interface AppShellProps {
  section: SectionKey
  hasTabs?: boolean
  tabs?: [Tab, Tab]
  children: React.ReactNode
}

export function AppShell({ section, hasTabs = false, tabs, children }: AppShellProps) {
  const navigate = useTransitionNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  const isHome = section === 'home'
  const accent = isHome ? MX4_COLOR : SECTION_ACCENTS[section]

  return (
    <AskSheetContext.Provider value={{ openAskSheet: () => setAskOpen(true) }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: COLORS.base,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          color: COLORS.text,
          overflow: 'hidden',
        }}
      >
        {/* Global texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            ...bactaTexture(accent),
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <TopBar
          section={section}
          onBack={isHome ? undefined : () => navigate('/')}
        />

        <TabContext.Provider value={{ tab, setTab }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overscrollBehavior: 'none',
              padding: '13px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {children}
          </div>

          <BottomBar
            accent={accent}
            hasTabs={hasTabs}
            tabs={tabs}
            onAsk={() => setAskOpen(true)}
            onNav={() => setNavOpen(true)}
          />
        </TabContext.Provider>

        <BottomSheet
          open={navOpen}
          onClose={() => setNavOpen(false)}
          currentSection={section}
        />

        <AskSheet
          open={askOpen}
          onClose={() => setAskOpen(false)}
          accent={accent}
          section={section}
        />
      </div>
    </AskSheetContext.Provider>
  )
}
