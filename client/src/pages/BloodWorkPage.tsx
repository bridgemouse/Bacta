import { useState } from 'react'
import { AppShell, type BottomAction } from '../components/AppShell'
import { SubNav } from '../components/SubNav'
import { MX4Card } from '../components/MX4Card'
import { COLORS } from '../theme'

const TABS = ['Overview', 'Results', 'Trends']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: "No panels uploaded yet. Upload your lab results to get MX-4's read on your blood work.",
  tone: 'caution' as const,
  flags: [],
}

const ACTIONS: BottomAction[] = [
  { icon: '📤', label: 'Upload',  onClick: () => {} },
  { icon: '📊', label: 'History', onClick: () => {} },
]

export function BloodWorkPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="bloodwork" actions={ACTIONS}>
      <SubNav tabs={TABS} active={activeTab} accent="#f87171" onChange={setActiveTab} />
      <MX4Card insight={MOCK_INSIGHT} section="bloodwork" />
      <div style={{
        background: COLORS.surfaceElevated,
        borderRadius: 10,
        padding: '20px 16px',
        textAlign: 'center',
        color: COLORS.textMuted,
        fontSize: 13,
      }}>
        No blood work panels uploaded yet.
      </div>
    </AppShell>
  )
}
