import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Trends']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: "HRV up 4ms from 7-day average — positive adaptation signal. Body battery at 74. Green for tomorrow's session.",
  tone: 'positive' as const,
  flags: [],
}

export function RecoveryPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="recovery" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <MX4Card insight={MOCK_INSIGHT} section="recovery" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="74"  label="Body Battery" accent={SECTION_ACCENTS.recovery} progress={0.74} />
        <MetricTile value="61"  unit="ms"  label="HRV"         accent="#a78bfa" trend="↑ +4ms" />
        <MetricTile value="52"  unit="bpm" label="Resting HR"  accent="#f472b6" />
        <MetricTile value="18"  unit="rpm" label="Respiration" accent="#34d399" />
      </div>
    </AppShell>
  )
}
