import { useState, useEffect } from 'react'
import { Sheet, SheetShell, SheetHeader } from '../../components/Sheet'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { createLogEntry, searchFoods, fetchRecentEntries, type Food, type FoodLogEntry } from '../../lib/nutritionApi'

const A = SECTION_ACCENTS.nutrition
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const

interface LogEntrySheetProps {
  open: boolean
  date: string
  meal: string
  onClose: () => void
  onLogged: () => void
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

export function LogEntrySheet({ open, date, meal: initialMeal, onClose, onLogged }: LogEntrySheetProps) {
  const [meal, setMeal] = useState(initialMeal)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [recents, setRecents] = useState<FoodLogEntry[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [macros, setMacros] = useState<Record<'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g', string>>({
    calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '',
  })
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName(''); setQty(''); setUnit('')
    setMacros({ calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' })
  }

  useEffect(() => {
    if (open) {
      setMeal(initialMeal)
    } else {
      reset()
    }
  }, [open, initialMeal])

  useEffect(() => {
    if (!open) return
    fetchRecentEntries(4).then(setRecents)
  }, [open])

  useEffect(() => {
    if (!query) { setResults([]); return }
    let cancelled = false
    searchFoods(query).then(r => { if (!cancelled) setResults(r) })
    return () => { cancelled = true }
  }, [query])

  async function handleSubmit() {
    if (!name || !qty || !unit || submitting) return
    setSubmitting(true)
    try {
      await createLogEntry({
        date, meal_type: meal, name, quantity: Number(qty), unit,
        calories: macros.calories === '' ? null : Number(macros.calories),
        protein_g: macros.protein_g === '' ? null : Number(macros.protein_g),
        carbs_g: macros.carbs_g === '' ? null : Number(macros.carbs_g),
        fat_g: macros.fat_g === '' ? null : Number(macros.fat_g),
        fiber_g: macros.fiber_g === '' ? null : Number(macros.fiber_g),
      })
      reset()
      onLogged()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetShell accent={A} onClose={onClose}>
        <SheetHeader accent={A} sigil={null} title="LOG ENTRY" sub={`${meal.toUpperCase()} · ${date}`} onClose={onClose} />
        <div style={{ padding: '0 18px 18px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {MEALS.map(m => (
              <button key={m} onClick={() => setMeal(m)} style={{
                flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: 9.5,
                border: `1px solid ${meal === m ? A : COLORS.line}`, background: meal === m ? hexA(A, 0.13) : 'transparent',
                color: meal === m ? A : COLORS.textMuted,
              }}>{m.toUpperCase()}</button>
            ))}
          </div>

          <input placeholder="Search saved foods…" value={query} onChange={e => setQuery(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }} />

          {!query && recents.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>
                RECENT · ONE TAP TO RE-LOG
              </div>
              {recents.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${COLORS.line}` }}>
                  <span style={{ fontFamily: FONT_UI, fontSize: 12.5, color: COLORS.text }}>{r.name}</span>
                  <button onClick={async () => {
                    await createLogEntry({ date, meal_type: meal, food_id: r.food_id, name: r.food_id == null ? r.name : undefined, quantity: r.quantity, unit: r.unit, calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, fiber_g: r.fiber_g })
                    onLogged(); onClose()
                  }} style={{ background: 'none', border: 'none', color: A, fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>+ LOG</button>
                </div>
              ))}
            </div>
          )}

          {query && results.length === 0 && (
            <div style={{ border: `1px dashed ${COLORS.line}`, borderRadius: 8, padding: '12px', marginBottom: 12, fontFamily: FONT_MONO, fontSize: 12, color: COLORS.textMuted }}>
              No match for &quot;{query}&quot; in saved foods — log it directly below, save it as a food to make it searchable next time.
            </div>
          )}

          {query && results.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {results.map(f => (
                <button key={f.id} onClick={() => { setSelectedFood(f); setQuery('') }} style={{
                  display: 'block', width: '100%', textAlign: 'left', background: COLORS.surface,
                  border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, cursor: 'pointer',
                }}>
                  <div style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text }}>{f.name}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
                    per {f.default_qty} {f.default_unit} · {f.calories ?? '—'} kcal · unit locked to {f.default_unit}
                  </div>
                </button>
              ))}
            </div>
          )}

          <input placeholder="What did you eat? (e.g. tacos from the truck)" value={name}
            onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="qty" value={qty} onChange={e => setQty(e.target.value)} style={inputStyle} />
            <input placeholder="unit (any)" value={unit} onChange={e => setUnit(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>
            MACROS OPTIONAL — LOG WHAT YOU KNOW, LEAVE THE REST BLANK
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
            {(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const).map(key => (
              <input key={key} placeholder="—" value={macros[key]}
                onChange={e => setMacros(m => ({ ...m, [key]: e.target.value }))}
                style={{ ...inputStyle, textAlign: 'center', padding: '7px 4px' }} />
            ))}
          </div>

          <button onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
            background: A, color: COLORS.base, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          }}>LOG ENTRY</button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
