// client/src/tabs/RecoveryTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function RecoveryTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="recovery" />
      <TrendChart metric="hrv" days={7} />
    </div>
  )
}
