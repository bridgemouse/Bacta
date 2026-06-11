import { useState } from 'react'
import { COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { hexA } from '../../lib/hexA'
import { fetchActivityLegs, type ActivityLeg, type GarminActivity } from '../../lib/garminApi'

type Sigil = 'run' | 'strength' | 'walk' | 'cycle' | 'cardio' | 'row' | 'multi'

const TYPE_SIGIL: Record<string, Sigil> = {
  running: 'run', trail_running: 'run', treadmill_running: 'run',
  walking: 'walk', hiking: 'walk', indoor_walking: 'walk',
  cycling: 'cycle', road_biking: 'cycle', mountain_biking: 'cycle', indoor_cycling: 'cycle',
  strength_training: 'strength', indoor_weightlifting: 'strength', gym_and_fitness_equipment: 'strength',
  indoor_cardio: 'cardio',
  indoor_rowing: 'row', rowing: 'row',
  multi_sport: 'multi',
}

const TYPE_LABEL: Record<string, string> = {
  running: 'Run', trail_running: 'Trail Run', treadmill_running: 'Treadmill',
  walking: 'Walk', hiking: 'Hike', indoor_walking: 'Walk',
  cycling: 'Ride', road_biking: 'Ride', mountain_biking: 'MTB', indoor_cycling: 'Cycling',
  strength_training: 'Strength', indoor_weightlifting: 'Weights', gym_and_fitness_equipment: 'Gym',
  indoor_cardio: 'Cardio', indoor_rowing: 'Rowing', rowing: 'Rowing',
  mobility: 'Mobility', multi_sport: 'Multisport',
}

const SIGIL_COLOR: Record<Sigil, string | null> = {
  run: null,        // uses accent
  strength: '#fb923c',
  walk: '#4ade80',
  cycle: '#fbbf24',
  cardio: '#fb923c',
  row: '#60a5fa',
  multi: null,
}

const RUN_TYPES = new Set(['running', 'trail_running', 'treadmill_running'])
const LEG_RUN_TYPES = new Set(['running', 'trail_running', 'treadmill_running'])
const LEG_ROW_TYPES = new Set(['indoor_rowing', 'rowing'])

function fmtDist(m: number | null): string | null {
  if (!m || m < 100) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function fmtDur(s: number | null): string | null {
  if (!s) return null
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function fmtWhen(startTime: string): string {
  const [datePart, timePart] = startTime.split(' ')
  const [year, month, dom] = datePart.split('-').map(Number)
  const [hour, minute] = (timePart ?? '00:00:00').split(':').map(Number)
  const d = new Date(year, month - 1, dom, hour, minute)
  const today = new Date()
  const toKey  = (y: number, m: number, day: number) => y * 10000 + m * 100 + day
  const actKey  = toKey(year, month, dom)
  const todKey  = toKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const yest    = new Date(today); yest.setDate(today.getDate() - 1)
  const yestKey = toKey(yest.getFullYear(), yest.getMonth() + 1, yest.getDate())
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (actKey === todKey)  return `TODAY · ${time}`
  if (actKey === yestKey) return `YDAY · ${time}`
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  return `${dayName} · ${time}`
}

function aerobicBenefit(te: number | null): string | null {
  if (te == null) return null
  if (te >= 4)   return 'HIGHLY IMPROVING'
  if (te >= 3)   return 'IMPROVING'
  if (te >= 2)   return 'MAINTAINING'
  return null
}

function ActivityGlyph({ sigil, color, size = 16 }: { sigil: Sigil; color: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {sigil === 'run' && (
        <g {...p}>
          <circle cx="15.5" cy="5" r="1.8" />
          <path d="M14 9.5 L10 12 L12.5 14.5 L11 20" />
          <path d="M14 9.5 L17.5 11.5 L20 10" />
          <path d="M12.5 14.5 L16 16 L18 21" />
          <path d="M10 12 L6 11.5" />
        </g>
      )}
      {sigil === 'walk' && (
        <g {...p}>
          <circle cx="12" cy="5" r="1.8" />
          <path d="M12 7.5 L10 13 L7 16" />
          <path d="M12 7.5 L14 11 L17 10" />
          <path d="M10 13 L9 19" />
          <path d="M10 13 L13 16 L14 20" />
        </g>
      )}
      {sigil === 'cycle' && (
        <g {...p}>
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="M6 16 L12 7 L18 16" />
          <path d="M12 7 L14 4" />
          <circle cx="14" cy="3.5" r="1" fill={color} stroke="none" />
        </g>
      )}
      {sigil === 'strength' && (
        <g {...p}>
          <line x1="4" y1="9" x2="4" y2="15" />
          <line x1="20" y1="9" x2="20" y2="15" />
          <line x1="7" y1="7" x2="7" y2="17" />
          <line x1="17" y1="7" x2="17" y2="17" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </g>
      )}
      {sigil === 'cardio' && (
        <g {...p}>
          <polyline points="2,12 6,12 8,6 10,18 12,10 14,14 16,12 22,12" />
        </g>
      )}
      {sigil === 'row' && (
        <g {...p}>
          <circle cx="12" cy="4.5" r="1.8" />
          <path d="M12 6.5 L10 10 L8 12" />
          <path d="M10 10 L14 11 L18 9" />
          <line x1="4" y1="16" x2="20" y2="16" strokeWidth={1.4} />
          <path d="M6 16 L5 19" />
          <path d="M10 16 L9 19" />
          <path d="M14 16 L15 19" />
          <path d="M18 16 L19 19" />
        </g>
      )}
      {(sigil === 'multi') && (
        <g {...p}>
          <circle cx="7" cy="12" r="3" />
          <circle cx="17" cy="12" r="3" />
          <line x1="10" y1="12" x2="14" y2="12" />
          <line x1="7" y1="9" x2="7" y2="6" />
          <line x1="17" y1="9" x2="17" y2="6" />
        </g>
      )}
    </svg>
  )
}

// ── Training Effect Bars ──────────────────────────────────────────────────────
function TrainingEffectBars({ aerobic, anaerobic, accent }: { aerobic: number; anaerobic: number; accent: string }) {
  const teLabel = (v: number) =>
    v >= 4 ? 'Highly Improving'
    : v >= 3 ? 'Improving'
    : v >= 2 ? 'Maintaining'
    : 'Minor Effect'

  const Bar = ({ val, label, color, sublabel }: { val: number; label: string; color: string; sublabel: string }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: '0.08em', color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700, color }}>
          {val.toFixed(1)}<span style={{ color: COLORS.textMuted, fontWeight: 400 }}>/5</span>
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: hexA(COLORS.textMuted, 0.1), overflow: 'hidden' }}>
        <div style={{ width: `${(val / 5) * 100}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, ${hexA(color, 0.45)}, ${color})` }} />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: hexA(color, 0.75), display: 'block', marginTop: 2 }}>
        {sublabel}
      </span>
    </div>
  )

  return (
    <div>
      <Bar val={aerobic}   label="AEROBIC"   color={accent}        sublabel={teLabel(aerobic)} />
      <Bar val={anaerobic} label="ANAEROBIC" color={COLORS.mx4Red} sublabel={teLabel(anaerobic)} />
    </div>
  )
}

// ── Activity Zone Bar ─────────────────────────────────────────────────────────
const ZONE_COLORS = ['#56657a', '#4ade80', '#fbbf24', '#f87171', '#ef4444']

function ActivityZoneBar({ zoneSecs }: { zoneSecs: [number, number, number, number, number] }) {
  const total = zoneSecs.reduce((s, v) => s + v, 0)
  if (total === 0) return null
  const zones = zoneSecs.map((s, i) => ({
    zone: i + 1,
    secs: s,
    pct: Math.round((s / total) * 100),
    color: ZONE_COLORS[i],
  })).filter(z => z.pct > 0)

  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 1.5, marginBottom: 5 }}>
        {zones.map(z => (
          <div key={z.zone} style={{ width: `${z.pct}%`, background: z.color,
            borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {z.pct >= 18 && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 6.5, fontWeight: 700, color: '#0b0d12' }}>
                {z.pct}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {zones.map(z => (
          <span key={z.zone} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: z.color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textSecondary }}>
              Z{z.zone}{' '}
              <span style={{ color: COLORS.text, fontWeight: 600 }}>{z.pct}%</span>
              <span style={{ color: COLORS.textMuted }}> · {Math.round(z.secs / 60)}m</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Run Dynamics Grid ─────────────────────────────────────────────────────────
interface RunDynamics { cadence: number; strideCm: number; vertOscCm: number; gctMs: number }

function RunDynamicsGrid({ dyn, accent }: { dyn: RunDynamics; accent: string }) {
  const stats = [
    { label: 'CADENCE',  val: dyn.cadence,   unit: 'spm', ideal: '170–185' },
    { label: 'STRIDE',   val: dyn.strideCm,  unit: 'cm',  ideal: '100–130' },
    { label: 'VERT OSC', val: dyn.vertOscCm, unit: 'cm',  ideal: '6–10' },
    { label: 'GCT',      val: dyn.gctMs,     unit: 'ms',  ideal: '<250' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: hexA(accent, 0.05),
          border: `1px solid ${hexA(accent, 0.18)}`, borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: '0.1em',
            color: COLORS.textMuted, marginBottom: 2 }}>{s.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700,
              color: accent, lineHeight: 1 }}>{s.val}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{s.unit}</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7, color: hexA(COLORS.textMuted, 0.7),
            marginTop: 1 }}>ideal {s.ideal}</div>
        </div>
      ))}
    </div>
  )
}

// ── Leg Card (used in multisport expand) ──────────────────────────────────────
function LegCard({ leg, accent }: { leg: ActivityLeg; accent: string }) {
  const sigil = TYPE_SIGIL[leg.type_key] ?? 'run'
  const label = TYPE_LABEL[leg.type_key] ?? leg.type_key.replace(/_/g, ' ')
  const color = SIGIL_COLOR[sigil] ?? accent
  const isRun = LEG_RUN_TYPES.has(leg.type_key)
  const isRow = LEG_ROW_TYPES.has(leg.type_key)
  const hasZones = (leg.zone1_s ?? 0) + (leg.zone2_s ?? 0) + (leg.zone3_s ?? 0) + (leg.zone4_s ?? 0) + (leg.zone5_s ?? 0) > 0
  const battDiff = leg.body_battery_diff != null && leg.body_battery_diff < 0 ? leg.body_battery_diff : null

  const extras: string[] = []
  if (isRun && leg.run_cadence != null) {
    extras.push(`${leg.run_cadence} spm`)
    if (leg.run_gct_ms != null) extras.push(`${leg.run_gct_ms}ms GCT`)
    if (leg.run_stride_cm != null) extras.push(`${leg.run_stride_cm}cm stride`)
    if (leg.run_power_w != null) extras.push(`${leg.run_power_w}W`)
  }
  if (isRow) {
    if (leg.distance_m != null && leg.distance_m > 0) extras.push(fmtDist(leg.distance_m) ?? '')
    if (leg.row_stroke_rate != null) extras.push(`${leg.row_stroke_rate} spm`)
    if (leg.row_power_w != null) extras.push(`${leg.row_power_w}W avg`)
  }

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: hasZones || extras.length > 0 ? 8 : 0 }}>
        <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hexA(color, 0.12), border: `1px solid ${hexA(color, 0.28)}` }}>
          <ActivityGlyph sigil={sigil} color={color} size={14} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
            color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, marginTop: 1 }}>
            {fmtDur(leg.duration_s)}
            {leg.calories != null && ` · ${leg.calories} kcal`}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {leg.avg_hr != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {leg.avg_hr}
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, fontWeight: 400 }}> avg bpm</span>
            </div>
          )}
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginTop: 2 }}>
            {[
              leg.max_hr != null && `max ${leg.max_hr}`,
              battDiff != null && `${battDiff}🔋`,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {hasZones && (
        <div style={{ marginBottom: extras.length > 0 ? 6 : 0 }}>
          <ActivityZoneBar zoneSecs={[
            leg.zone1_s ?? 0, leg.zone2_s ?? 0, leg.zone3_s ?? 0,
            leg.zone4_s ?? 0, leg.zone5_s ?? 0,
          ]} />
        </div>
      )}

      {extras.length > 0 && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginTop: 2 }}>
          {extras.join(' · ')}
        </div>
      )}
    </div>
  )
}

// ── LogEntry ──────────────────────────────────────────────────────────────────
interface LogEntryProps {
  activity: GarminActivity
  accent: string
}

export function LogEntry({ activity: a, accent }: LogEntryProps) {
  const [open, setOpen] = useState(false)
  const [legs, setLegs] = useState<ActivityLeg[] | null>(null)
  const [legsLoading, setLegsLoading] = useState(false)

  const sigil = TYPE_SIGIL[a.type_key] ?? 'run'
  const label = TYPE_LABEL[a.type_key] ?? a.name
  const sigilColor = SIGIL_COLOR[sigil] ?? accent
  const isRun = RUN_TYPES.has(a.type_key)
  const isMultiSport = a.type_key === 'multi_sport'

  const stats = [
    fmtDist(a.distance_m),
    fmtDur(a.duration_s),
    a.calories != null ? `${Math.round(a.calories)} kcal` : null,
    a.avg_hr != null ? `${Math.round(a.avg_hr)} bpm` : null,
  ].filter(Boolean)

  const benefit = aerobicBenefit(a.aerobic_te)

  const hasZones = !isMultiSport && ((a.zone1_s ?? 0) + (a.zone2_s ?? 0) + (a.zone3_s ?? 0) + (a.zone4_s ?? 0) + (a.zone5_s ?? 0) > 0)
  const hasTrainingEffect = !isMultiSport && a.aerobic_te != null && a.aerobic_te >= 1.0
  const hasRunDynamics = !isMultiSport && isRun && a.run_cadence != null
  const hasContent = isMultiSport || hasTrainingEffect || hasZones || hasRunDynamics

  const handleToggle = () => {
    if (!open && isMultiSport && legs === null && !legsLoading) {
      setLegsLoading(true)
      fetchActivityLegs(a.activity_id).then(data => {
        setLegs(data)
        setLegsLoading(false)
      })
    }
    setOpen(o => !o)
  }

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${open ? hexA(accent, 0.4) : COLORS.line}`,
      borderRadius: 8, overflow: 'hidden',
      transition: 'border-color 0.18s ease',
    }}>
      <button
        onClick={handleToggle}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11,
          padding: '10px 12px', background: 'transparent', border: 'none',
          cursor: hasContent ? 'pointer' : 'default',
          textAlign: 'left', font: 'inherit', color: 'inherit',
        }}
      >
        <span style={{
          fontFamily: FONT_MONO, fontSize: 13, color: hasContent ? accent : COLORS.textMuted,
          marginRight: -4, flexShrink: 0,
          display: 'block', lineHeight: 1,
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.18s ease',
        }}>›</span>
        <span style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hexA(sigilColor, 0.13), border: `1px solid ${hexA(sigilColor, 0.3)}`,
        }}>
          <ActivityGlyph sigil={sigil} color={sigilColor} size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 650, color: COLORS.text }}>
            {label}
          </span>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary,
            marginTop: 3, letterSpacing: '0.02em',
          }}>
            {stats.join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
            display: 'block', letterSpacing: '0.04em',
          }}>
            {fmtWhen(a.start_time)}
          </span>
          {benefit && (
            <span style={{
              fontFamily: FONT_MONO, fontSize: 7.5, fontWeight: 700,
              color: accent, display: 'block', marginTop: 2,
            }}>{benefit}</span>
          )}
        </div>
      </button>

      {open && hasContent && (
        <div style={{
          borderTop: `1px solid ${hexA(accent, 0.2)}`,
          padding: '12px 13px 13px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Multisport: per-leg breakdown */}
          {isMultiSport && (
            <div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
                color: COLORS.textSecondary, fontWeight: 600, display: 'block', marginBottom: 2 }}>
                WORKOUT LEGS
              </span>
              {legsLoading && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>Loading…</span>
              )}
              {legs != null && legs.length === 0 && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>No leg data available</span>
              )}
              {legs != null && legs.length > 0 && legs.map((leg, i) => (
                <div key={leg.leg_id}>
                  {i > 0 && (
                    <div style={{ height: 1, background: hexA(accent, 0.12), margin: '0 0 0 0' }} />
                  )}
                  <LegCard leg={leg} accent={accent} />
                </div>
              ))}
            </div>
          )}

          {/* Single-sport: training effect */}
          {hasTrainingEffect && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8.5,
                  letterSpacing: '0.1em', color: COLORS.textSecondary, fontWeight: 600 }}>
                  TRAINING EFFECT
                </span>
                {a.recovery_time_h != null && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 4,
                    background: hexA(COLORS.mx4Amber, 0.1),
                    border: `1px solid ${hexA(COLORS.mx4Amber, 0.32)}` }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.mx4Amber }}>
                      REC TIME {a.recovery_time_h}H
                    </span>
                  </div>
                )}
              </div>
              <TrainingEffectBars
                aerobic={a.aerobic_te!}
                anaerobic={a.anaerobic_te ?? 0}
                accent={accent}
              />
            </div>
          )}

          {hasZones && (
            <div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
                color: COLORS.textSecondary, fontWeight: 600, display: 'block', marginBottom: 7 }}>
                HR ZONES
              </span>
              <ActivityZoneBar zoneSecs={[
                a.zone1_s ?? 0,
                a.zone2_s ?? 0,
                a.zone3_s ?? 0,
                a.zone4_s ?? 0,
                a.zone5_s ?? 0,
              ]} />
            </div>
          )}

          {hasRunDynamics && (
            <div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
                color: COLORS.textSecondary, fontWeight: 600, display: 'block', marginBottom: 7 }}>
                RUNNING DYNAMICS
              </span>
              <RunDynamicsGrid
                dyn={{
                  cadence:   a.run_cadence!,
                  strideCm:  a.run_stride_cm ?? 0,
                  vertOscCm: a.run_vert_osc_cm ?? 0,
                  gctMs:     a.run_gct_ms ?? 0,
                }}
                accent={accent}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
