import { useState } from 'react'
import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'

// Widened nutrient set (#140) — sub-macro fat components, sodium/sugar/cholesterol/
// potassium, key vitamins/minerals. Kept out of the primary 5-field macro grid (too
// cramped for 12 more fields) behind a collapsed disclosure, matching the issue's
// explicit "not a silent grid-widening" requirement.
export const EXTENDED_NUTRIENT_KEYS = [
  'sodium_mg', 'sugar_g', 'saturated_fat_g', 'polyunsaturated_fat_g', 'monounsaturated_fat_g',
  'trans_fat_g', 'cholesterol_mg', 'potassium_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
  'calcium_mg', 'iron_mg',
] as const
export type ExtendedNutrientKey = typeof EXTENDED_NUTRIENT_KEYS[number]

const LABELS: Record<ExtendedNutrientKey, string> = {
  sodium_mg: 'SODIUM (MG)', sugar_g: 'SUGAR (G)', saturated_fat_g: 'SAT FAT (G)',
  polyunsaturated_fat_g: 'POLY FAT (G)', monounsaturated_fat_g: 'MONO FAT (G)', trans_fat_g: 'TRANS FAT (G)',
  cholesterol_mg: 'CHOLESTEROL (MG)', potassium_mg: 'POTASSIUM (MG)', vitamin_a_mcg: 'VITAMIN A (MCG)',
  vitamin_c_mg: 'VITAMIN C (MG)', calcium_mg: 'CALCIUM (MG)', iron_mg: 'IRON (MG)',
}

// SparkyFitness's own category set (server/api/nutrition.ts's glycemic_index column
// comment) — not a numeric GI value.
const GLYCEMIC_OPTIONS = ['', 'Very Low', 'Low', 'Medium', 'High', 'Very High'] as const

export interface ExtendedNutrients {
  values: Record<ExtendedNutrientKey, string>
  glycemicIndex: string
  allergens: string
  traces: string
}

export function emptyExtendedNutrients(): ExtendedNutrients {
  return {
    values: Object.fromEntries(EXTENDED_NUTRIENT_KEYS.map(k => [k, ''])) as Record<ExtendedNutrientKey, string>,
    glycemicIndex: '', allergens: '', traces: '',
  }
}

// Converts editable form state into the API payload shape (numbers, undefined for
// blank, string arrays for allergens/traces) — the API itself JSON.stringifies
// allergens/traces/custom_nutrients at the write boundary, so this stays a plain array.
export function extendedNutrientsToPayload(data: ExtendedNutrients): Record<string, unknown> {
  const numeric = Object.fromEntries(
    EXTENDED_NUTRIENT_KEYS.map(k => [k, data.values[k] === '' ? undefined : Number(data.values[k])])
  )
  const toList = (s: string): string[] | undefined => {
    const trimmed = s.trim()
    return trimmed ? trimmed.split(',').map(part => part.trim()).filter(Boolean) : undefined
  }
  return {
    ...numeric,
    glycemic_index: data.glycemicIndex || undefined,
    allergens: toList(data.allergens),
    traces: toList(data.traces),
  }
}

// Converts a stored row (allergens/traces as JSON-string arrays, per the API's
// round-trip convention) back into editable form state, for pre-filling an edit sheet.
export function payloadToExtendedNutrients(rowIn: object | null | undefined): ExtendedNutrients {
  if (!rowIn) return emptyExtendedNutrients()
  const row = rowIn as Record<string, unknown>
  const parseList = (v: unknown): string => {
    if (typeof v !== 'string') return ''
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed.join(', ') : ''
    } catch {
      return ''
    }
  }
  return {
    values: Object.fromEntries(EXTENDED_NUTRIENT_KEYS.map(k => [k, row[k] == null ? '' : String(row[k])])) as Record<ExtendedNutrientKey, string>,
    glycemicIndex: typeof row.glycemic_index === 'string' ? row.glycemic_index : '',
    allergens: parseList(row.allergens),
    traces: parseList(row.traces),
  }
}

interface MoreNutrientsSectionProps {
  accent: string
  data: ExtendedNutrients
  onChange: (data: ExtendedNutrients) => void
  // Targets don't support glycemic_index/allergens/traces at the API level (they
  // describe a food, not a daily target) — hide those inputs in that context.
  numericOnly?: boolean
}

export function MoreNutrientsSection({ accent, data, onChange, numericOnly }: MoreNutrientsSectionProps) {
  const [open, setOpen] = useState(false)

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
    border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
    color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
  }
  const fieldLabelStyle = { display: 'block', fontFamily: FONT_MONO, fontSize: 7, color: COLORS.textMuted, marginBottom: 3 }

  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '8px 0', borderRadius: 6, border: `1px dashed ${hexA(accent, 0.4)}`,
        background: 'transparent', color: accent, fontFamily: FONT_MONO, fontSize: 9.5, cursor: 'pointer',
      }}>{open ? '− MORE NUTRIENTS' : '+ MORE NUTRIENTS'}</button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: numericOnly ? 0 : 8 }}>
            {EXTENDED_NUTRIENT_KEYS.map(key => (
              <div key={key}>
                <label style={fieldLabelStyle}>{LABELS[key]}</label>
                <input aria-label={key} placeholder="—" value={data.values[key]}
                  onChange={e => onChange({ ...data, values: { ...data.values, [key]: e.target.value } })}
                  style={{ ...inputStyle, textAlign: 'center', padding: '6px 3px', fontSize: 10 }} />
              </div>
            ))}
          </div>

          {!numericOnly && (
            <>
              <label htmlFor="more-nutrients-glycemic-index" style={fieldLabelStyle}>GLYCEMIC INDEX</label>
              <select id="more-nutrients-glycemic-index" aria-label="Glycemic index" value={data.glycemicIndex}
                onChange={e => onChange({ ...data, glycemicIndex: e.target.value })}
                style={{ ...inputStyle, marginBottom: 8 }}>
                {GLYCEMIC_OPTIONS.map(opt => <option key={opt} value={opt}>{opt || '—'}</option>)}
              </select>

              <label htmlFor="more-nutrients-allergens" style={fieldLabelStyle}>ALLERGENS (COMMA-SEPARATED)</label>
              <input id="more-nutrients-allergens" aria-label="Allergens" placeholder="e.g. peanuts, dairy" value={data.allergens}
                onChange={e => onChange({ ...data, allergens: e.target.value })}
                style={{ ...inputStyle, marginBottom: 8 }} />

              <label htmlFor="more-nutrients-traces" style={fieldLabelStyle}>TRACES (COMMA-SEPARATED)</label>
              <input id="more-nutrients-traces" aria-label="Traces" placeholder="e.g. tree nuts" value={data.traces}
                onChange={e => onChange({ ...data, traces: e.target.value })}
                style={inputStyle} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
