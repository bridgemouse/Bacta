// client/src/tabs/HomeTab.tsx
import { useState, useEffect, useCallback } from 'react'
import { getGarminSummary, triggerPoll, triggerAzi3 } from '../api'
import { AziCard } from '../components/AziCard'
import { StatGrid } from '../components/StatGrid'
import { LogForm } from '../components/LogForm'
import type { GarminSummary } from '../api'

export function HomeTab() {
  const [summary, setSummary] = useState<GarminSummary>({})
  const [polling, setPolling] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchSummary = useCallback(async () => {
    const data = await getGarminSummary()
    setSummary(data)
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  async function handlePoll() {
    setPolling(true)
    await triggerPoll()
    await new Promise((r) => setTimeout(r, 2000))
    await fetchSummary()
    setPolling(false)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    await triggerAzi3()
    // Spinner for 3s — feedback that signal was sent (run takes minutes)
    await new Promise((r) => setTimeout(r, 3000))
    setRegenerating(false)
  }

  const steps = summary.steps

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-bold text-gray-50">Bacta</h1>
        <div className="flex items-center gap-2">
          {/* AZI-3 Regenerate button */}
          <button
            aria-label="Regenerate"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-40 p-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={regenerating ? 'animate-spin' : ''}
            >
              <path d="M12 2a10 10 0 0 1 7.38 16.75" />
              <path d="m16 16 3 3-3 3" />
              <path d="M12 22a10 10 0 0 1-7.38-16.75" />
              <path d="m8 8-3-3 3-3" />
            </svg>
          </button>
          {/* Garmin Sync button */}
          <button
            aria-label="Sync"
            onClick={handlePoll}
            disabled={polling}
            className="text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-40 p-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={polling ? 'animate-spin' : ''}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </div>

      {/* AZI-3 Daily Briefing */}
      <div className="px-4">
        <AziCard section="recovery" />
      </div>

      {/* Stat Grid */}
      <div className="px-4">
        <StatGrid summary={summary} />
      </div>

      {/* Steps Progress */}
      {steps !== undefined && (
        <div className="mx-4 rounded-xl bg-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Steps</span>
            <span className="text-base font-bold text-gray-50">{steps.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min((steps / 10000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            {Math.round((steps / 10000) * 100)}% of 10k
          </p>
        </div>
      )}

      {/* Log Form */}
      <div className="px-4">
        <LogForm />
      </div>
    </div>
  )
}
