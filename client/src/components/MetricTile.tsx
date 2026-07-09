import { Bracket } from './primitives/Bracket'
import { Sigil } from './primitives/Sigil'
import { Sparkline } from './primitives/Sparkline'
import { Ring } from './primitives/Ring'
import { ReadinessDots } from './primitives/ReadinessDots'
import { FadeValue } from './primitives/FadeValue'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

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
  calibrating?: boolean
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

  if (tile.calibrating) {
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
          border: `1px dashed ${hexA(accent, 0.25)}`,
          borderRadius: 7,
          padding: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          width: '100%',
          opacity: 0.55,
        }}
      >
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${hexA(accent, 0.25)}, transparent 80%)` }} />
        <Bracket color={accent} inset={5} op={0.2} radius={3} size={9} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hexA(accent, 0.07), border: `1px solid ${hexA(accent, 0.15)}` }}>
            <Sigil name={tile.key} color={accent} size={14} />
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.14em', color: hexA(accent, 0.7), flex: 1 }}>{label}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{idx}</span>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.14em', color: hexA(accent, 0.45), marginTop: 6 }}>
          ◦ CALIBRATING
        </span>
      </button>
    )
  }

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

      {/* Header: sigil chip + label + index */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
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

      {/* Value + sub, paired inline with the ring dial when present */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <FadeValue value={tile.value}>
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
            </FadeValue>
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
        {hasRing && (
          <Ring progress={tile.ring!} accent={accent} size={38} stroke={3}>
            <FadeValue value={Math.round(tile.ring! * 100)}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: COLORS.text }}>
                {Math.round(tile.ring! * 100)}
              </span>
            </FadeValue>
          </Ring>
        )}
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
