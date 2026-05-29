import { useState } from 'react'
import { AppShell, type BottomAction } from '../components/AppShell'
import { SubNav } from '../components/SubNav'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'Workouts', 'Load', 'VO2 Max', 'Volume', 'Pace']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'Training load moderate — week 4 of 8 in your Garmin Coach block. VO2 max holding at 48. Thursday tempo is the key session.',
  tone: 'positive' as const,
  flags: [],
}

const ACTIONS: BottomAction[] = [
  { icon: '✏️', label: 'Log',  onClick: () => {} },
  { icon: '🔄', label: 'Sync', onClick: () => {} },
]

export function TrainingPage() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  return (
    <AppShell section="training" actions={ACTIONS}>
      <SubNav tabs={TABS} active={activeTab} accent={SECTION_ACCENTS.training} onChange={setActiveTab} />
      <MX4Card insight={MOCK_INSIGHT} section="training" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="342"  label="Training Load" accent={SECTION_ACCENTS.training} />
        <MetricTile value="48"   label="VO2 Max"       accent={SECTION_ACCENTS.training} trend="→ stable" />
        <MetricTile value="28"   unit="km"   label="Weekly Volume" accent={SECTION_ACCENTS.training} />
        <MetricTile value="5:42" unit="/km"  label="Avg Pace"      accent={SECTION_ACCENTS.training} />
      </div>
    </AppShell>
  )
}
