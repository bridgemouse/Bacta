import { AppShell } from '../components/AppShell'
import { useTab } from '../lib/TabContext'
import { NutritionOverview } from './nutrition/NutritionOverview'
import { NutritionLibrary } from './nutrition/NutritionLibrary'

function NutritionContent() {
  const tab = useTab()
  return tab === 'library' ? <NutritionLibrary /> : <NutritionOverview />
}

export function NutritionPage() {
  return (
    <AppShell section="nutrition" hasTabs tabs={['overview', 'library']}>
      <NutritionContent />
    </AppShell>
  )
}
