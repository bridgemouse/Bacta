import { COLORS, FONT_MONO } from '../../theme'

export const MACRO_KEYS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const
export type MacroKey = typeof MACRO_KEYS[number]

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

interface MacroGridInputsProps {
  values: Record<MacroKey, string>
  onChange: (key: MacroKey, value: string) => void
  // Per-field accessible label — omit for the (more common) unlabeled Quick Track grids;
  // provide for forms with multiple grids on screen at once (e.g. one per recipe ingredient).
  ariaLabel?: (key: MacroKey) => string
  gap?: number
  marginBottom?: number
  inputFontSize?: number
  inputPadding?: string
}

export function MacroGridInputs({
  values, onChange, ariaLabel, gap = 6, marginBottom = 14, inputFontSize, inputPadding = '7px 4px',
}: MacroGridInputsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap, marginBottom }}>
      {MACRO_KEYS.map(key => (
        <input key={key} aria-label={ariaLabel?.(key)} placeholder="—" value={values[key]}
          onChange={e => onChange(key, e.target.value)}
          style={{ ...inputStyle, textAlign: 'center', padding: inputPadding, ...(inputFontSize != null ? { fontSize: inputFontSize } : {}) }} />
      ))}
    </div>
  )
}
