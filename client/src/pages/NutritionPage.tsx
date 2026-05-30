import { AppShell } from '../components/AppShell'
import { MX4Card } from '../components/MX4Card'
import { MetricTile } from '../components/MetricTile'
import { SECTION_ACCENTS } from '../theme'

const MOCK_INSIGHT = {
  generated_at: new Date().toISOString(),
  summary: 'Calories on target. Protein slightly under at 142g vs 160g goal — worth closing the gap at dinner. Weight trend stable.',
  tone: 'caution' as const,
  flags: ['protein under target'],
}

export function NutritionPage() {
  return (
    <AppShell section="nutrition">
      <MX4Card insight={MOCK_INSIGHT} section="nutrition" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricTile value="2,340" unit="kcal" label="Calories" accent={SECTION_ACCENTS.nutrition} progress={0.94} />
        <MetricTile value="142"   unit="g"    label="Protein"  accent={SECTION_ACCENTS.nutrition} progress={0.89} trend="↓ 18g under" />
        <MetricTile value="280"   unit="g"    label="Carbs"    accent={SECTION_ACCENTS.nutrition} />
        <MetricTile value="74"    unit="g"    label="Fat"      accent={SECTION_ACCENTS.nutrition} />
      </div>
    </AppShell>
  )
}
