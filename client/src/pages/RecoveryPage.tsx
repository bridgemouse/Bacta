import { PageShell } from '../components/PageShell'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const TABS = ['Overview', 'HRV', 'Body Battery', 'Stress', 'SpO2']

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'HRV up 4ms from 7-day average — positive adaptation signal. Body battery at 74. Green for tomorrow\'s session.',
  tone: 'positive' as const,
  flags: [],
}

interface RecoveryPageProps { onMenuOpen: () => void }

export function RecoveryPage({ onMenuOpen }: RecoveryPageProps) {
  return (
    <PageShell section="recovery" tabs={TABS} insight={MOCK_INSIGHT} onMenuOpen={onMenuOpen}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="74"  label="Body Battery" accent={SECTION_ACCENTS.recovery} progress={0.74} />
        <MetricTile value="61"  unit="ms" label="HRV" accent="#a78bfa" trend="↑ +4ms" />
        <MetricTile value="52"  unit="bpm" label="Resting HR" accent="#f472b6" />
        <MetricTile value="18"  unit="rpm" label="Respiration" accent="#34d399" />
      </div>
    </PageShell>
  )
}
