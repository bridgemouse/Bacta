import { COLORS, FONT_MONO } from '../../theme'
import { hexA } from '../../lib/hexA'
import { Bracket } from '../primitives/Bracket'

interface HeadlineCardProps {
  accent: string
  label: string
  children: React.ReactNode
  foot?: React.ReactNode
}

/** Two-up headliner metric card shell with bracket ticks + top accent edge. */
export function HeadlineCard({ accent, label, children, foot }: HeadlineCardProps) {
  return (
    <div style={{
      position: 'relative', flex: 1,
      background: COLORS.surface, border: `1px solid ${COLORS.line}`,
      borderRadius: 10, padding: '12px 13px 11px',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <Bracket color={accent} inset={6} op={0.4} radius={4} />
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${accent}, transparent 80%)`,
        opacity: 0.85,
      }} />
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: COLORS.textSecondary,
        fontWeight: 600, marginBottom: 8, paddingLeft: 3,
      }}>
        {label}
      </div>
      {children}
      {foot && <div style={{ marginTop: 'auto', paddingTop: 8 }}>{foot}</div>}
    </div>
  )
}
