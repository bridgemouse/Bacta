// client/src/tabs/FitnessTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function FitnessTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="vo2-fitness" />
      <TrendChart metric="vo2max" days={30} />
    </div>
  )
}
