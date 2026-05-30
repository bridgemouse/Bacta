import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: '8.1h with a score of 82 — solid night. Deep sleep slightly low at 18%. Consistent with the mileage spike this week.',
  tone: 'positive' as const,
  flags: [],
}

export function SleepPage() {
  return (
    <AppShell section="sleep">
      <MX4Card insight={MOCK_INSIGHT} section="sleep" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="8.1" unit="h"  label="Duration"    accent={SECTION_ACCENTS.sleep} />
        <MetricTile value="82"            label="Sleep Score"  accent={SECTION_ACCENTS.sleep} progress={0.82} />
        <MetricTile value="18"  unit="%" label="Deep Sleep"   accent={SECTION_ACCENTS.sleep} />
        <MetricTile value="24"  unit="%" label="REM"          accent={SECTION_ACCENTS.sleep} />
      </div>
    </AppShell>
  )
}
