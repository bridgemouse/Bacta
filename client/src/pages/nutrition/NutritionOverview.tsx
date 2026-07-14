import { useState } from 'react'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { useNutritionLog } from '../../hooks/useNutritionLog'
import { todayLocal, addDaysLocal, relativeDayLabel, absoluteDateLabel } from '../../lib/nutritionDate'

const A = SECTION_ACCENTS.nutrition

export function NutritionOverview() {
  const [date, setDate] = useState(todayLocal())
  const { log, loading } = useNutritionLog(date)
  const isToday = date === todayLocal()

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          aria-label="Previous day"
          onClick={() => setDate(d => addDaysLocal(d, -1))}
          style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`,
            background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer',
          }}
        >‹</button>
        <button
          onClick={() => setDate(todayLocal())}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '8px 0', borderRadius: 8, cursor: 'pointer', background: COLORS.surface,
            border: `1px solid ${isToday ? hexA(A, 0.5) : COLORS.line}`,
          }}
        >
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: A }}>
            {relativeDayLabel(date)}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>
            {absoluteDateLabel(date)}
          </span>
        </button>
        <button
          aria-label="Next day"
          onClick={() => setDate(d => addDaysLocal(d, 1))}
          style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`,
            background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer',
          }}
        >›</button>
      </div>

      {!loading && log && Object.keys(log.meals).length === 0 && (
        <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>
          NO ENTRIES LOGGED {isToday ? 'YET TODAY' : 'THIS DAY'}
        </p>
      )}
    </>
  )
}
