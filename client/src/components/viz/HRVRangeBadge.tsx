import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'
import { StatusCore } from '../primitives/StatusCore'
import type { HrvDirection } from '../../hooks/useRecoveryData'

interface HRVRangeBadgeProps {
  inRange: boolean
  direction: HrvDirection | null
  dirColor: string
}

// "IN RANGE/BELOW" compares today's value to baseline; the direction badge is a
// 7-day slope. They measure different things and can legitimately disagree (e.g.
// BELOW today after a sharp one-day drop, while the week overall trends up) — the
// caption exists so that combination reads as complementary context, not a
// contradiction (see #115).
export function HRVRangeBadge({ inRange, direction, dirColor }: HRVRangeBadgeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, maxWidth: 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5,
          background: hexA(inRange ? COLORS.green : COLORS.amber, 0.12),
          border: `1px solid ${hexA(inRange ? COLORS.green : COLORS.amber, 0.42)}`,
        }}>
          <StatusCore accent={inRange ? COLORS.green : COLORS.amber} size={5} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: inRange ? COLORS.green : COLORS.amber }}>
            {inRange ? 'IN RANGE' : 'BELOW'}
          </span>
        </div>
        {direction && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5,
            background: hexA(dirColor, 0.11), border: `1px solid ${hexA(dirColor, 0.38)}`,
          }}>
            <StatusCore accent={dirColor} size={5} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: dirColor }}>
              {direction.label}
            </span>
          </div>
        )}
      </div>
      {direction && (
        <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: COLORS.textMuted, textAlign: 'right' }}>
          today vs. 7-day trend
        </span>
      )}
    </div>
  )
}
