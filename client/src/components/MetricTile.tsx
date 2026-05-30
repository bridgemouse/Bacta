import { Bracket } from './primitives/Bracket'
import { Sigil } from './primitives/Sigil'
import { Sparkline } from './primitives/Sparkline'
import { Ring } from './primitives/Ring'
import { ReadinessDots } from './primitives/ReadinessDots'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

// ---------------------------------------------------------------------------
// Legacy MetricTile — kept for backward compat with page components
// ---------------------------------------------------------------------------
interface MetricTileProps {
  value: string
  unit?: string
  label: string
  accent: string
  progress?: number
  trend?: string
}

export function MetricTile({ value, unit, label, accent, progress, trend }: MetricTileProps) {
  return (
    <div
      style={{
        background: COLORS.surface,
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ color: accent, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ color: COLORS.textMuted, fontSize: 11 }}>{unit}</span>}
      </div>
      <div style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>{label}</div>
      {trend && <div style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>{trend}</div>}
      {progress !== undefined && (
        <div
          data-testid="metric-progress"
          style={{
            height: 2,
            background: COLORS.surface,
            borderRadius: 1,
            marginTop: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(progress * 100, 100)}%`,
              background: accent,
              borderRadius: 1,
            }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SystemCard — new component
// ---------------------------------------------------------------------------

export type VizType = 'spark' | 'ring' | 'dots' | 'shield'

export interface SystemCardTile {
  key: Exclude<SectionKey, 'home'>
  value: string
  unit: string
  sub: string
  viz: VizType
  spark?: number[]
  ring?: number
  dots?: number
  status: string
}

interface SystemCardProps {
  tile: SystemCardTile
  index: number
  onClick?: () => void
}

export function SystemCard({ tile, index, onClick }: SystemCardProps) {
  const accent = SECTION_ACCENTS[tile.key]
  const label = SECTION_LABELS[tile.key].toUpperCase()
  const idx = String(index).padStart(2, '0')
  const hasRing = tile.viz === 'ring' && tile.ring !== undefined

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        textAlign: 'left',
        font: 'inherit',
        color: COLORS.text,
        cursor: 'pointer',
        background: COLORS.surface,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 7,
        padding: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        width: '100%',
      }}
    >
      {/* Top accent edge */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent 80%)`,
        }}
      />

      {/* Corner bracket decoration */}
      <Bracket color={accent} inset={5} op={0.4} radius={3} size={9} />

      {/* Ring positioned at top-right for ring viz */}
      {hasRing && (
        <span style={{ position: 'absolute', top: 10, right: 10 }}>
          <Ring progress={tile.ring!} accent={accent} size={38} stroke={3} />
        </span>
      )}

      {/* Header: sigil chip + label + index */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          paddingRight: hasRing ? 44 : 0,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hexA(accent, 0.13),
            border: `1px solid ${hexA(accent, 0.28)}`,
          }}
        >
          <Sigil name={tile.key} color={accent} size={14} />
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.14em',
            color: accent,
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
          {idx}
        </span>
      </div>

      {/* Value + sub */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.text,
              lineHeight: 1,
            }}
          >
            {tile.value}
          </span>
          {tile.unit && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: COLORS.textMuted }}>
              {tile.unit}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: COLORS.textSecondary,
            marginTop: 3,
          }}
        >
          {tile.sub}
        </div>
      </div>

      {/* Viz */}
      {tile.viz === 'spark' && tile.spark && (
        <Sparkline data={tile.spark} accent={accent} w={140} h={24} sw={1.6} />
      )}
      {tile.viz === 'dots' && tile.dots !== undefined && (
        <ReadinessDots value={tile.dots} accent={accent} />
      )}
      {tile.viz === 'shield' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.1em',
              color: accent,
            }}
          >
            {tile.status}
          </span>
        </div>
      )}
    </button>
  )
}
