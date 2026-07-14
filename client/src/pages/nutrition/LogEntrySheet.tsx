import { useState, useEffect } from 'react'
import { Sheet, SheetShell, SheetHeader } from '../../components/Sheet'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { createLogEntry, searchFoods, fetchRecentEntries, type Food, type FoodLogEntry } from '../../lib/nutritionApi'

const A = SECTION_ACCENTS.nutrition
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const

function scaledPreview(food: Food, qty: number) {
  const factor = qty / food.default_qty
  const round2 = (v: number | null) => v == null ? null : Math.round(v * factor * 100) / 100
  return {
    calories: food.calories == null ? null : Math.round(food.calories * factor),
    protein_g: round2(food.protein_g),
    carbs_g: round2(food.carbs_g),
    fat_g: round2(food.fat_g),
  }
}

function qtyForGoal(food: Food, macroKey: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g', goal: number): number | null {
  const perDefaultQty = food[macroKey]
  if (perDefaultQty == null || perDefaultQty === 0) return null
  return Math.round((goal * food.default_qty / perDefaultQty) * 100) / 100
}

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
  const [goalMacro, setGoalMacro] = useState<'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | null>(null)
  const [goalValue, setGoalValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName(''); setQty(''); setUnit('')
    setMacros({ calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' })
    setSelectedFood(null); setGoalMacro(null); setGoalValue('')
  }

  useEffect(() => {
    if (open) {
      setMeal(initialMeal)
    } else {
      reset()
    }
  }, [open, initialMeal])

  useEffect(() => {
    if (!selectedFood || !goalMacro || goalValue === '') return
    const computed = qtyForGoal(selectedFood, goalMacro, Number(goalValue))
    if (computed != null) setQty(String(computed))
  }, [selectedFood, goalMacro, goalValue])

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
    if (submitting) return
    if (selectedFood) {
      if (!qty) return
      setSubmitting(true)
      try {
        await createLogEntry({ date, meal_type: meal, food_id: selectedFood.id, quantity: Number(qty), unit: selectedFood.default_unit })
        setSelectedFood(null); setGoalMacro(null); setGoalValue('')
        onLogged(); onClose()
      } finally {
        setSubmitting(false)
      }
      return
    }
    if (!name || !qty || !unit) return
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
      onLogged(); onClose()
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

          {!query && recents.length === 0 && (
            <div style={{ fontFamily: FONT_UI, fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 1.4 }}>
              No saved foods yet — reference database grows as you save foods, or log ad-hoc below. Nothing to search is normal.
            </div>
          )}

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
            <div style={{ border: `1px dashed ${COLORS.line}`, borderRadius: 8, padding: '12px', marginBottom: 12, fontFamily: FONT_UI, fontSize: 12, color: COLORS.textMuted }}>
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

          {selectedFood ? (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '12px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{selectedFood.name}</span>
                <button aria-label="Clear selected food" onClick={() => { setSelectedFood(null); setGoalMacro(null); setGoalValue('') }}
                  style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <span style={{ ...inputStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6, color: A, borderColor: hexA(A, 0.4) }}>
                  🔒 <span style={{ fontFamily: FONT_MONO }}>{selectedFood.default_unit}</span> <span style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: FONT_MONO }}>LOCKED</span>
                </span>
              </div>
              {qty !== '' && (() => {
                const preview = scaledPreview(selectedFood, Number(qty))
                return (
                  <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, marginBottom: 10 }}>
                    auto: {preview.calories ?? '—'} kcal · P {preview.protein_g ?? '—'} · C {preview.carbs_g ?? '—'} · F {preview.fat_g ?? '—'}
                  </div>
                )
              })()}
              <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>
                NO MACRO MATH — SET QTY FROM A GOAL
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map(key => (
                  <button key={key} onClick={() => setGoalMacro(key)} style={{
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: 9,
                    border: `1px solid ${goalMacro === key ? A : COLORS.line}`, background: goalMacro === key ? `${A}22` : 'transparent',
                    color: goalMacro === key ? A : COLORS.textMuted,
                  }}>{key === 'protein_g' ? 'P' : key === 'carbs_g' ? 'C' : key === 'fat_g' ? 'F' : 'KCAL'}</button>
                ))}
                <input placeholder="goal" value={goalValue} onChange={e => setGoalValue(e.target.value)} style={{ ...inputStyle, width: 70 }} />
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

          <button onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
            background: A, color: COLORS.base, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          }}>LOG ENTRY</button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
