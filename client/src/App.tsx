import { Routes, Route } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { HomePage } from './pages/HomePage'
import { RecoveryPage } from './pages/RecoveryPage'
import { TrainingPage } from './pages/TrainingPage'
import { SleepPage } from './pages/SleepPage'
import { NutritionPage } from './pages/NutritionPage'
import { BloodWorkPage } from './pages/BloodWorkPage'
import { DailyLogPage } from './pages/DailyLogPage'
import { SettingsPage } from './pages/SettingsPage'
import { LogsPage } from './pages/LogsPage'

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/"          element={<HomePage />} />
        <Route path="/recovery"  element={<RecoveryPage />} />
        <Route path="/training"  element={<TrainingPage />} />
        <Route path="/sleep"     element={<SleepPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/bloodwork" element={<BloodWorkPage />} />
        <Route path="/dailylog"  element={<DailyLogPage />} />
        <Route path="/settings"  element={<SettingsPage />} />
        <Route path="/settings/logs" element={<LogsPage />} />
      </Routes>
    </AuthGate>
  )
}
