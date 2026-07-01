import { Routes, Route } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { ToastProvider } from './lib/ToastContext'
import { ToastContainer } from './components/ToastContainer'
import { HomePage } from './pages/HomePage'
import { RecoveryPage } from './pages/RecoveryPage'
import { TrainingPage } from './pages/TrainingPage'
import { SleepPage } from './pages/SleepPage'
import { NutritionPage } from './pages/NutritionPage'
import { BloodWorkPage } from './pages/BloodWorkPage'
import { DailyLogPage } from './pages/DailyLogPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <ToastProvider>
      <AuthGate>
        <ToastContainer />
        <Routes>
          <Route path="/"          element={<HomePage />} />
          <Route path="/recovery"  element={<RecoveryPage />} />
          <Route path="/training"  element={<TrainingPage />} />
          <Route path="/sleep"     element={<SleepPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/bloodwork" element={<BloodWorkPage />} />
          <Route path="/dailylog"  element={<DailyLogPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
        </Routes>
      </AuthGate>
    </ToastProvider>
  )
}
