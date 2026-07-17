import { useState, useEffect } from 'react'
import { Sheet, SheetShell, SheetHeader } from '../../components/Sheet'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { updateLogEntry, deleteLogEntry, createLogEntry, entryToLogInput, type FoodLogEntry, type LogEntryInput } from '../../lib/nutritionApi'
import { todayLocal } from '../../lib/nutritionDate'
import { useToast } from '../../lib/ToastContext'
import { MacroGridInputs, MACRO_KEYS, type MacroKey } from './MacroGridInputs'
import { MoreNutrientsSection, emptyExtendedNutrients, extendedNutrientsToPayload, payloadToExtendedNutrients, type ExtendedNutrients } from './MoreNutrientsSection'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

const A = SECTION_ACCENTS.nutrition

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

interface EditEntrySheetProps {
  open: boolean
  entry: FoodLogEntry | null
  date: string
  onClose: () => void
  onSaved: () => void
}

export function EditEntrySheet({ open, entry, date, onClose, onSaved }: EditEntrySheetProps) {
  const { showToast } = useToast()
  const [displayEntry, setDisplayEntry] = useState<FoodLogEntry | null>(entry)
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [macros, setMacros] = useState<Record<MacroKey, string>>({ calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' })
  const [extended, setExtended] = useState<ExtendedNutrients>(emptyExtendedNutrients())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (entry) {
      setDisplayEntry(entry)
      setQty(String(entry.quantity))
      setUnit(entry.unit)
      setMacros({
        calories: entry.calories == null ? '' : String(entry.calories),
        protein_g: entry.protein_g == null ? '' : String(entry.protein_g),
        carbs_g: entry.carbs_g == null ? '' : String(entry.carbs_g),
        fat_g: entry.fat_g == null ? '' : String(entry.fat_g),
        fiber_g: entry.fiber_g == null ? '' : String(entry.fiber_g),
      })
      setExtended(payloadToExtendedNutrients(entry))
    }
  }, [entry])

  if (!displayEntry) return null
  const currentEntry: FoodLogEntry = displayEntry
  const isLinked = currentEntry.food_id != null
  const isToday = date === todayLocal()

  async function handleSave() {
    if (!(Number(qty) > 0)) { showToast('Quantity must be greater than 0.', 'error'); return }
    setSubmitting(true)
    try {
      const updates: Partial<LogEntryInput> = {}
      if (Number(qty) !== currentEntry.quantity) updates.quantity = Number(qty)
      if (!isLinked && unit !== currentEntry.unit) updates.unit = unit
      for (const key of MACRO_KEYS) {
        const newVal = macros[key] === '' ? null : Number(macros[key])
        if (newVal !== currentEntry[key]) updates[key] = newVal
      }
      // Compare against the entry's current widened fields round-tripped through the same
      // parse/format functions (not the raw entry) — currentEntry.allergens is a JSON-string
      // from the API, but extendedNutrientsToPayload produces a plain array, so a direct
      // comparison would always look "changed" even when nothing was edited. Sending every
      // widened field on every save (matching the pre-fix behavior here) would also stop the
      // server from rescaling them on a quantity change, since it only rescales macros that
      // are absent from the request body.
      const originalExtendedPayload = extendedNutrientsToPayload(payloadToExtendedNutrients(currentEntry))
      const newExtendedPayload = extendedNutrientsToPayload(extended)
      const updatesRecord = updates as Record<string, unknown>
      for (const [key, value] of Object.entries(newExtendedPayload)) {
        if (JSON.stringify(value) !== JSON.stringify(originalExtendedPayload[key])) updatesRecord[key] = value
      }
      await updateLogEntry(currentEntry.id, updates)
      onSaved(); onClose()
    } catch (err) {
      showToast(errorMessage(err, 'Could not save changes.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setSubmitting(true)
    try {
      await deleteLogEntry(currentEntry.id)
      onSaved(); onClose()
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete entry.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyToToday() {
    try {
      await createLogEntry(entryToLogInput(currentEntry, { date: todayLocal() }))
      onSaved(); onClose()
    } catch (err) {
      showToast(errorMessage(err, 'Could not copy entry to today.'), 'error')
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetShell accent={A} onClose={onClose}>
        <SheetHeader accent={A} sigil={null} title="EDIT ENTRY" sub={`${displayEntry.name} · ${displayEntry.meal_type.toUpperCase()}`} onClose={onClose} />
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
            {isLinked
              ? 'LINKED TO A SAVED FOOD — UNIT IS FIXED, NO CONVERSION · CHANGING QUANTITY RESCALES EACH MACRO UNLESS YOU OVERRIDE IT BELOW · TO CHANGE THE FOOD ITSELF, DELETE AND RE-LOG'
              : 'ALL FIELDS FREE · BLANK MACROS STAY UNKNOWN (SHOWN AS —)'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            {isLinked ? (
              <span style={{ ...inputStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6, color: A, borderColor: hexA(A, 0.4) }}>
                🔒 {unit} <span style={{ fontSize: 8, color: COLORS.textMuted }}>LOCKED</span>
              </span>
            ) : (
              <input aria-label="Unit" value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            )}
          </div>
          <MacroGridInputs values={macros} onChange={(key, value) => setMacros(m => ({ ...m, [key]: value }))} ariaLabel={key => key} />
          <MoreNutrientsSection accent={A} data={extended} onChange={setExtended} />
          {!isToday && (
            <button onClick={handleCopyToToday} style={{
              width: '100%', padding: '9px 0', marginBottom: 10, borderRadius: 8,
              border: `1px solid ${hexA(A, 0.4)}`, background: 'transparent', color: A,
              fontFamily: FONT_MONO, fontSize: 10, cursor: 'pointer',
            }}>COPY THIS ITEM TO TODAY</button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDelete} disabled={submitting} style={{
              flex: 1, padding: '11px 0', borderRadius: 8, border: `1px solid ${hexA(COLORS.red, 0.5)}`,
              background: 'transparent', color: COLORS.red, fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
            }}>DELETE</button>
            <button onClick={handleSave} disabled={submitting} style={{
              flex: 2, padding: '11px 0', borderRadius: 8, border: 'none', background: A, color: COLORS.base,
              fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
            }}>SAVE CHANGES</button>
          </div>
        </div>
      </SheetShell>
    </Sheet>
  )
}
