// client/src/App.tsx
import { useState } from 'react'
import { TabBar } from './components/TabBar'
import { HomeTab } from './tabs/HomeTab'
import { RecoveryTab } from './tabs/RecoveryTab'
import { SleepTab } from './tabs/SleepTab'
import { TrainingTab } from './tabs/TrainingTab'
import { FitnessTab } from './tabs/FitnessTab'
import type { TabId } from './components/TabBar'

export function App() {
  const [active, setActive] = useState<TabId>('home')
  // Track which tabs have been mounted — once mounted, they stay mounted
  const [mounted, setMounted] = useState<Set<TabId>>(new Set(['home']))

  function handleTabChange(tab: TabId) {
    setActive(tab)
    setMounted((prev) => new Set([...prev, tab]))
  }

  function show(tab: TabId) {
    return active === tab ? undefined : 'none'
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Scrollable content area — padded for tab bar */}
      <main className="pb-20 overflow-y-auto">
        <div style={{ display: show('home') }} data-testid="home-tab">
          <HomeTab />
        </div>

        {mounted.has('recovery') && (
          <div style={{ display: show('recovery') }} data-testid="recovery-tab">
            <RecoveryTab />
          </div>
        )}

        {mounted.has('sleep') && (
          <div style={{ display: show('sleep') }} data-testid="sleep-tab">
            <SleepTab />
          </div>
        )}

        {mounted.has('training') && (
          <div style={{ display: show('training') }} data-testid="training-tab">
            <TrainingTab />
          </div>
        )}

        {mounted.has('fitness') && (
          <div style={{ display: show('fitness') }} data-testid="fitness-tab">
            <FitnessTab />
          </div>
        )}
      </main>

      <TabBar active={active} onChange={handleTabChange} />
    </div>
  )
}
