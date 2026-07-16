import { useState } from 'react'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { useNutritionLog } from '../../hooks/useNutritionLog'
import { useBriefing } from '../../hooks/useBriefing'
import { todayLocal, addDaysLocal, relativeDayLabel, absoluteDateLabel } from '../../lib/nutritionDate'
import type { MealGroup, NutritionSummary, FoodLogEntry } from '../../lib/nutritionApi'
import { createLogEntry, entryToLogInput } from '../../lib/nutritionApi'
import { MX4Briefing } from '../../components/MX4Card'
import { BRIEFS } from '../../lib/stubData'
import { LogEntrySheet } from './LogEntrySheet'
import { EditEntrySheet } from './EditEntrySheet'
import { TargetsSheet } from './TargetsSheet'

const A = SECTION_ACCENTS.nutrition
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const

async function copyMealToToday(group: MealGroup, mealKey: string) {
  for (const entry of group.entries) {
    await createLogEntry(entryToLogInput(entry, { date: todayLocal(), meal_type: mealKey }))
  }
}

function orderedMealKeys(meals: Record<string, MealGroup>): string[] {
  const known = MEAL_ORDER.filter(m => m in meals)
  const custom = Object.keys(meals).filter(k => !(MEAL_ORDER as readonly string[]).includes(k))
  return [...known, ...custom]
}

function macroText(remaining: number | null): string {
  if (remaining == null) return '—'
  return remaining < 0 ? `${Math.abs(remaining)} g over` : `${remaining} g left`
}

function MacroRow({ label, remaining, target }: { label: string; remaining: number | null; target: number | null }) {
  const over = remaining != null && remaining < 0
  const pct = target != null && target > 0 && remaining != null
    ? Math.min(100, Math.max(0, ((target - remaining) / target) * 100))
    : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary, width: 52, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: hexA(COLORS.textMuted, 0.15), overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: over ? COLORS.amber : A }} />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, width: 92, textAlign: 'right', flexShrink: 0 }}>
        {macroText(remaining)}
      </span>
    </div>
  )
}

function LedgerHero({ summary, date }: { summary: NutritionSummary | null; date: string }) {
  const today = todayLocal()
  const isPast = date < today
  const isFuture = date > today
  const label = isPast ? 'ENDED THE DAY' : isFuture ? 'BUDGET' : 'REMAINING TODAY'
  const remainingKcal = summary?.remaining.calories ?? null
  const targetKcal = summary?.target?.calories ?? null
  const actualKcal = summary?.actual.calories ?? 0
  const over = remainingKcal != null && remainingKcal < 0

  return (
    <div style={{
      position: 'relative', background: `linear-gradient(150deg, ${hexA(A, 0.1)}, ${COLORS.surface} 60%)`,
      border: `1px solid ${hexA(A, 0.32)}`, borderRadius: 13, padding: '15px 16px', marginBottom: 9,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary, letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 34, fontWeight: 700, color: COLORS.text }}>
              {remainingKcal == null ? '—' : `${over ? '−' : ''}${Math.abs(remainingKcal)}`}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textMuted }}>kcal</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, marginTop: 2 }}>
            {actualKcal} logged{targetKcal != null ? ` · target ${targetKcal}` : ''}
          </div>
        </div>
        {remainingKcal != null && (
          <span style={{
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            padding: '4px 9px', borderRadius: 20, background: hexA(A, 0.15), color: A, border: `1px solid ${hexA(A, 0.4)}`,
          }}>
            {Math.abs(remainingKcal)} {over ? 'OVER' : 'UNDER'} TARGET
          </span>
        )}
      </div>
      <MacroRow label="PROTEIN" remaining={summary?.remaining.protein_g ?? null} target={summary?.target?.protein_g ?? null} />
      <MacroRow label="CARBS" remaining={summary?.remaining.carbs_g ?? null} target={summary?.target?.carbs_g ?? null} />
      <MacroRow label="FAT" remaining={summary?.remaining.fat_g ?? null} target={summary?.target?.fat_g ?? null} />
      <MacroRow label="FIBER" remaining={summary?.remaining.fiber_g ?? null} target={summary?.target?.fiber_g ?? null} />
    </div>
  )
}

function MealGroupCard({ mealKey, group, onOpenLog, onEntryClick, isToday, onCopied }: { mealKey: string; group: MealGroup; onOpenLog: () => void; onEntryClick: (entry: FoodLogEntry) => void; isToday: boolean; onCopied: () => void }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: A, letterSpacing: '0.1em' }}>
          {mealKey.toUpperCase()}
        </span>
        <span style={{ flex: 1, height: 1, background: COLORS.line }} />
        {!isToday && (
          <button onClick={() => copyMealToToday(group, mealKey).then(onCopied)} style={{
            background: 'none', border: `1px solid ${hexA(A, 0.4)}`, borderRadius: 5, padding: '2px 7px',
            color: A, fontFamily: FONT_MONO, fontSize: 8, cursor: 'pointer',
          }}>COPY TO TODAY</button>
        )}
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{group.totals.calories} KCAL</span>
      </div>
      {group.entries.map(entry => (
        <div key={entry.id} onClick={() => onEntryClick(entry)} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderLeft: `2px solid ${A}`, background: COLORS.surface, borderRadius: 6,
          padding: '9px 11px', marginBottom: 6, cursor: 'pointer',
        }}>
          <div>
            <div style={{ fontFamily: FONT_UI, fontSize: 13.5, fontWeight: 600, color: COLORS.text }}>{entry.name}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
              {entry.quantity} {entry.unit} · {entry.food_id != null ? 'saved food' : 'ad-hoc'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
              {entry.calories == null ? '—' : entry.calories} <span style={{ fontSize: 10, fontWeight: 400, color: COLORS.textMuted }}>kcal</span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
              P {entry.protein_g ?? '—'} · C {entry.carbs_g ?? '—'} · F {entry.fat_g ?? '—'}
            </div>
          </div>
        </div>
      ))}
      <button onClick={onOpenLog} style={{
        width: '100%', padding: '8px 0', borderRadius: 6, border: `1px dashed ${hexA(A, 0.4)}`,
        background: 'transparent', color: A, fontFamily: FONT_MONO, fontSize: 9.5, cursor: 'pointer',
      }}>
        + ADD TO {mealKey.toUpperCase()}
      </button>
    </div>
  )
}

export function NutritionOverview() {
  const [date, setDate] = useState(todayLocal())
  const { log, summary, loading, refresh } = useNutritionLog(date)
  const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('nutrition')
  const [logSheetMeal, setLogSheetMeal] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<FoodLogEntry | null>(null)
  const [targetsOpen, setTargetsOpen] = useState(false)
  const isToday = date === todayLocal()
  const mealKeys = log ? orderedMealKeys(log.meals) : []
  const missingMeals = MEAL_ORDER.filter(m => !mealKeys.includes(m))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          aria-label="Previous day"
          onClick={() => setDate(d => addDaysLocal(d, -1))}
          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer' }}
        >‹</button>
        <button
          onClick={() => setDate(todayLocal())}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '8px 0', borderRadius: 8, cursor: 'pointer', background: COLORS.surface,
            border: `1px solid ${isToday ? hexA(A, 0.5) : COLORS.line}`,
          }}
        >
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: A }}>{relativeDayLabel(date)}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>{absoluteDateLabel(date)}</span>
        </button>
        <button
          aria-label="Next day"
          onClick={() => setDate(d => addDaysLocal(d, 1))}
          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer' }}
        >›</button>
      </div>

      {isToday && (
        <MX4Briefing accent={A} brief={BRIEFS.nutrition} liveData={liveBriefing ?? undefined} section="nutrition" onRefresh={refreshBriefing} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '16px 0 11px' }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.2em',
          color: A, fontWeight: 600, flexShrink: 0,
        }}>
          {isToday ? 'TODAY · SO FAR' : date < todayLocal() ? `CLOSED DAY · ${relativeDayLabel(date)}` : `PLANNED · ${relativeDayLabel(date)}`}
        </span>
        <span style={{
          flex: 1, height: 1,
          background: `linear-gradient(90deg, ${hexA(A, 0.4)}, ${COLORS.line})`,
        }} />
        <button onClick={() => setTargetsOpen(true)} style={{
          fontFamily: FONT_MONO, fontSize: 9,
          color: COLORS.textMuted, letterSpacing: '0.06em', flexShrink: 0,
          border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
        }}>
          {summary?.target ? `TARGET SET ${summary.target.date} · EDIT ›` : 'NO TARGET SET · SET ›'}
        </button>
      </div>

      <LedgerHero summary={summary} date={date} />

      {!loading && log && mealKeys.length === 0 && (
        <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>
          NO ENTRIES LOGGED {isToday ? 'YET TODAY' : 'THIS DAY'}
        </p>
      )}

      {log && mealKeys.map(mealKey => (
        <MealGroupCard key={mealKey} mealKey={mealKey} group={log.meals[mealKey]} isToday={isToday}
          onEntryClick={setEditEntry}
          onOpenLog={() => setLogSheetMeal(mealKey)}
          onCopied={() => { setDate(todayLocal()); refresh() }} />
      ))}

      {missingMeals.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {missingMeals.map(meal => (
            <button key={meal} onClick={() => setLogSheetMeal(meal)} style={{
              flex: '1 1 45%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '10px 0', borderRadius: 8, border: `1px dashed ${COLORS.line}`,
              background: 'transparent', color: COLORS.textMuted, cursor: 'pointer',
            }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700 }}>+ {meal.toUpperCase()}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8 }}>NOT LOGGED YET</span>
            </button>
          ))}
        </div>
      )}

      <LogEntrySheet
        open={logSheetMeal !== null}
        date={date}
        meal={logSheetMeal ?? 'breakfast'}
        onClose={() => setLogSheetMeal(null)}
        onLogged={refresh}
      />

      <EditEntrySheet
        open={editEntry !== null}
        entry={editEntry}
        date={date}
        onClose={() => setEditEntry(null)}
        onSaved={refresh}
      />

      <TargetsSheet
        open={targetsOpen}
        initialTarget={summary?.target ?? null}
        onClose={() => setTargetsOpen(false)}
        onSaved={refresh}
      />
    </>
  )
}
