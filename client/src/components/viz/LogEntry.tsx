import { useState } from 'react'
import { COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { hexA } from '../../lib/hexA'
import type { GarminActivity } from '../../lib/garminApi'

type Sigil = 'run' | 'strength' | 'walk' | 'cycle'

const TYPE_SIGIL: Record<string, Sigil> = {
  running: 'run', trail_running: 'run', treadmill_running: 'run',
  walking: 'walk', hiking: 'walk', indoor_walking: 'walk',
  cycling: 'cycle', road_biking: 'cycle', mountain_biking: 'cycle', indoor_cycling: 'cycle',
  strength_training: 'strength', indoor_weightlifting: 'strength', gym_and_fitness_equipment: 'strength',
}

const TYPE_LABEL: Record<string, string> = {
  running: 'Run', trail_running: 'Trail Run', treadmill_running: 'Treadmill',
  walking: 'Walk', hiking: 'Hike', indoor_walking: 'Walk',
  cycling: 'Ride', road_biking: 'Ride', mountain_biking: 'MTB', indoor_cycling: 'Cycling',
  strength_training: 'Strength', indoor_weightlifting: 'Weights', gym_and_fitness_equipment: 'Gym',
}

const SIGIL_COLOR: Record<Sigil, string | null> = {
  run: null,        // uses accent
  strength: '#fb923c',
  walk: '#4ade80',
  cycle: '#fbbf24',
}

const RUN_TYPES = new Set(['running', 'trail_running', 'treadmill_running'])

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
  if (actKey === yestKey) return `YESTERDAY · ${time}`
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
        {zones.map(z => (
          <span key={z.zone} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: z.color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textSecondary }}>
              Z{z.zone} {z.pct}%
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

// ── LogEntry ──────────────────────────────────────────────────────────────────
interface LogEntryProps {
  activity: GarminActivity
  accent: string
}

export function LogEntry({ activity: a, accent }: LogEntryProps) {
  const [open, setOpen] = useState(false)
  const sigil = TYPE_SIGIL[a.type_key] ?? 'run'
  const label = TYPE_LABEL[a.type_key] ?? a.name
  const sigilColor = SIGIL_COLOR[sigil] ?? accent
  const isRun = RUN_TYPES.has(a.type_key)

  const stats = [
    fmtDist(a.distance_m),
    fmtDur(a.duration_s),
    a.calories != null ? `${Math.round(a.calories)} kcal` : null,
    a.avg_hr != null ? `${Math.round(a.avg_hr)} bpm` : null,
  ].filter(Boolean)

  const benefit = aerobicBenefit(a.aerobic_te)

  const hasZones = (a.zone1_s ?? 0) + (a.zone2_s ?? 0) + (a.zone3_s ?? 0) + (a.zone4_s ?? 0) + (a.zone5_s ?? 0) > 0
  const hasTrainingEffect = a.aerobic_te != null && a.aerobic_te >= 1.0
  const hasRunDynamics = isRun && a.run_cadence != null
  const hasContent = hasTrainingEffect || hasZones || hasRunDynamics

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${open ? hexA(accent, 0.4) : COLORS.line}`,
      borderRadius: 8, overflow: 'hidden',
      transition: 'border-color 0.18s ease',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
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
            fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textSecondary,
            marginTop: 3, letterSpacing: '0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {stats.join('  ·  ')}
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
