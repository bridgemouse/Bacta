import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { RecoveryPage } from './pages/RecoveryPage'
import { TrainingPage } from './pages/TrainingPage'
import { SleepPage } from './pages/SleepPage'
import { NutritionPage } from './pages/NutritionPage'
import { BloodWorkPage } from './pages/BloodWorkPage'
import { DailyLogPage } from './pages/DailyLogPage'

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<HomePage />} />
      <Route path="/recovery"  element={<RecoveryPage />} />
      <Route path="/training"  element={<TrainingPage />} />
      <Route path="/sleep"     element={<SleepPage />} />
      <Route path="/nutrition" element={<NutritionPage />} />
      <Route path="/bloodwork" element={<BloodWorkPage />} />
      <Route path="/dailylog"  element={<DailyLogPage />} />
    </Routes>
  )
}
