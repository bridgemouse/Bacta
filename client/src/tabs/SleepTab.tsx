// client/src/tabs/SleepTab.tsx
import { AziCard } from '../components/AziCard'
import { TrendChart } from '../components/TrendChart'

export function SleepTab() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <AziCard section="sleep-quality" />
      <TrendChart metric="sleep_duration" days={7} />
    </div>
  )
}
