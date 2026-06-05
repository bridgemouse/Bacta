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
  const d = new Date(startTime.replace(' ', 'T'))
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diffDays === 0) return `TODAY · ${time}`
  if (diffDays === 1) return `YESTERDAY · ${time}`
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  return `${day} · ${time}`
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

interface LogEntryProps {
  activity: GarminActivity
  accent: string
}

export function LogEntry({ activity: a, accent }: LogEntryProps) {
  const [open, setOpen] = useState(false)
  const sigil = TYPE_SIGIL[a.type_key] ?? 'run'
  const label = TYPE_LABEL[a.type_key] ?? a.name
  const stats = [
    fmtDist(a.distance_m),
    fmtDur(a.duration_s),
    a.calories != null ? `${a.calories} kcal` : null,
    a.avg_hr != null ? `${a.avg_hr} bpm` : null,
  ].filter(Boolean)

  const hasContent = false

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${open ? hexA(accent, 0.4) : COLORS.line}`,
      borderRadius: 8, overflow: 'hidden',
      transition: 'border-color 0.18s ease',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11,
          padding: '10px 12px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit',
        }}
      >
        <span style={{
          fontFamily: FONT_MONO, fontSize: 13, color: accent, marginRight: -4, flexShrink: 0,
          display: 'block', lineHeight: 1,
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.18s ease',
        }}>›</span>
        <span style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hexA(accent, 0.13), border: `1px solid ${hexA(accent, 0.3)}`,
        }}>
          <ActivityGlyph sigil={sigil} color={accent} size={17} />
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
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted,
          flexShrink: 0, textAlign: 'right', letterSpacing: '0.04em',
        }}>
          {fmtWhen(a.start_time)}
        </span>
      </button>

      {open && hasContent && (
        <div style={{
          borderTop: `1px solid ${hexA(accent, 0.2)}`,
          padding: '12px 13px 13px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
        </div>
      )}
    </div>
  )
}
