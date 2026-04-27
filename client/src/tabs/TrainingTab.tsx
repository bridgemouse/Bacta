// client/src/tabs/TrainingTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function TrainingTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="training-week" />
      <TrendChart metric="steps" days={7} />
    </div>
  )
}
