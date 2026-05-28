import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { COLORS } from './theme'
import { Drawer } from './components/Drawer'
import { HomePage } from './pages/HomePage'
import { RecoveryPage } from './pages/RecoveryPage'
import { TrainingPage } from './pages/TrainingPage'
import { SleepPage } from './pages/SleepPage'
import { NutritionPage } from './pages/NutritionPage'
import { BloodWorkPage } from './pages/BloodWorkPage'
import { DailyLogPage } from './pages/DailyLogPage'

function useActiveSection(): string {
  const { pathname } = useLocation()
  const seg = pathname.split('/').filter(Boolean)[0]
  return seg || 'home'
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const activeSection = useActiveSection()

  const menuProps = { onMenuOpen: () => setDrawerOpen(true) }

  return (
    <div style={{ background: COLORS.base, minHeight: '100dvh' }}>
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeSection={activeSection}
      />
      <Routes>
        <Route path="/"           element={<HomePage     {...menuProps} />} />
        <Route path="/recovery"   element={<RecoveryPage {...menuProps} />} />
        <Route path="/training"   element={<TrainingPage {...menuProps} />} />
        <Route path="/sleep"      element={<SleepPage    {...menuProps} />} />
        <Route path="/nutrition"  element={<NutritionPage {...menuProps} />} />
        <Route path="/bloodwork"  element={<BloodWorkPage {...menuProps} />} />
        <Route path="/dailylog"   element={<DailyLogPage  {...menuProps} />} />
      </Routes>
    </div>
  )
}
