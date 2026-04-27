// client/src/components/LogForm.tsx
import { useState, useEffect } from 'react'
import { getManualToday, postManual } from '../api'

const SUPPLEMENTS = [
  { id: 'creatine',   label: 'Creatine' },
  { id: 'vitamin_d',  label: 'Vitamin D' },
  { id: 'omega_3',    label: 'Omega-3' },
  { id: 'magnesium',  label: 'Magnesium' },
]

export function LogForm() {
  const [readiness, setReadiness]       = useState<number | undefined>(undefined)
  const [caffeine, setCaffeine]         = useState<number | undefined>(undefined)
  const [supplements, setSupplements]   = useState<string[]>([])
  const [saved, setSaved]               = useState(false)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    getManualToday().then((entry) => {
      if (entry) {
        if (entry.readiness) setReadiness(entry.readiness)
        if (entry.caffeine_mg) setCaffeine(entry.caffeine_mg)
        if (entry.supplements) {
          try { setSupplements(JSON.parse(entry.supplements)) } catch { /* ignore */ }
        }
      }
      setLoading(false)
    })
  }, [])

  function toggleSupplement(id: string) {
    setSupplements((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    await postManual({
      readiness,
      caffeine_mg: caffeine,
      supplements,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="h-32 rounded-xl bg-gray-800 animate-pulse" />
  }

  return (
    <div className="rounded-xl bg-gray-700 p-4 space-y-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Daily Log</p>

      {/* Readiness */}
      <div>
        <p className="text-sm text-gray-300 mb-2">Readiness</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setReadiness(n)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                readiness === n
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Caffeine */}
      <div>
        <label className="text-sm text-gray-300 block mb-2">Caffeine (mg)</label>
        <input
          type="number"
          step={25}
          min={0}
          value={caffeine ?? ''}
          onChange={(e) => setCaffeine(e.target.value ? Number(e.target.value) : undefined)}
          placeholder="0"
          className="w-full bg-gray-600 rounded-lg px-3 py-2 text-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Supplements */}
      <div>
        <p className="text-sm text-gray-300 mb-2">Supplements</p>
        <div className="grid grid-cols-2 gap-2">
          {SUPPLEMENTS.map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={supplements.includes(id)}
                onChange={() => toggleSupplement(id)}
                className="accent-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
      >
        {saved ? 'Logged ✓' : 'Save'}
      </button>
    </div>
  )
}
