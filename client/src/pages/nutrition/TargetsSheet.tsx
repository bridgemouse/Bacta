import { useState, useEffect } from 'react'
import { Sheet, SheetShell, SheetHeader } from '../../components/Sheet'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../../theme'
import { saveTargets, type NutritionTarget } from '../../lib/nutritionApi'
import { todayLocal } from '../../lib/nutritionDate'
import { useToast } from '../../lib/ToastContext'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

const A = SECTION_ACCENTS.nutrition

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

function sumKcal(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9)
}

interface TargetsSheetProps {
  open: boolean
  initialTarget: NutritionTarget | null
  onClose: () => void
  onSaved: () => void
}

export function TargetsSheet({ open, initialTarget, onClose, onSaved }: TargetsSheetProps) {
  const { showToast } = useToast()
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [calories, setCalories] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setProtein(initialTarget?.protein_g != null ? String(initialTarget.protein_g) : '')
    setCarbs(initialTarget?.carbs_g != null ? String(initialTarget.carbs_g) : '')
    setFat(initialTarget?.fat_g != null ? String(initialTarget.fat_g) : '')
    setFiber(initialTarget?.fiber_g != null ? String(initialTarget.fiber_g) : '')
    setCalories(initialTarget?.calories != null ? String(initialTarget.calories) : '')
  }, [open, initialTarget])

  function recomputeKcal(p: string, c: string, f: string) {
    setCalories(String(sumKcal(Number(p) || 0, Number(c) || 0, Number(f) || 0)))
  }

  const macroSum = sumKcal(Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0)
  const matchesMacros = Math.abs((Number(calories) || 0) - macroSum) <= 2

  async function handleSave() {
    setSubmitting(true)
    try {
      await saveTargets({
        date: todayLocal(),
        calories: calories === '' ? undefined : Number(calories),
        protein_g: protein === '' ? undefined : Number(protein),
        carbs_g: carbs === '' ? undefined : Number(carbs),
        fat_g: fat === '' ? undefined : Number(fat),
        fiber_g: fiber === '' ? undefined : Number(fiber),
      })
      onSaved(); onClose()
    } catch (err) {
      showToast(errorMessage(err, 'Could not save targets.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetShell accent={A} onClose={onClose}>
        <SheetHeader accent={A} sigil={null} title="DAILY TARGETS"
          sub={`${initialTarget ? `TARGET SET ${initialTarget.date}` : 'NO TARGET SET'} · APPLIES FROM TODAY FORWARD`} onClose={onClose} />
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 8 }}>MACRO GOALS (g)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
            <div>
              <label htmlFor="protein-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>P</label>
              <input id="protein-goal" aria-label="Protein goal" value={protein}
                onChange={e => { setProtein(e.target.value); recomputeKcal(e.target.value, carbs, fat) }} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="carbs-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>C</label>
              <input id="carbs-goal" aria-label="Carbs goal" value={carbs}
                onChange={e => { setCarbs(e.target.value); recomputeKcal(protein, e.target.value, fat) }} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="fat-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>F</label>
              <input id="fat-goal" aria-label="Fat goal" value={fat}
                onChange={e => { setFat(e.target.value); recomputeKcal(protein, carbs, e.target.value) }} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="fiber-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>FIBER</label>
              <input id="fiber-goal" aria-label="Fiber goal" value={fiber} onChange={e => setFiber(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>CALORIE GOAL (fiber excluded from the P/C/F sum)</div>
          <input aria-label="Calorie goal" value={calories} onChange={e => setCalories(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: matchesMacros ? COLORS.mx4Green : COLORS.mx4Amber, marginBottom: 14 }}>
            {matchesMacros ? 'MATCHES MACROS ✓' : `MACROS SUM TO ${macroSum}`}
          </div>

          <button onClick={handleSave} disabled={submitting} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
            background: A, color: COLORS.base, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          }}>SAVE TARGETS</button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
