import { COLORS, FONT_MONO, type CardInfo } from '../../theme'
import { Bracket } from '../primitives/Bracket'
import { useCardInfoOverlay, InfoOverlay } from '../../lib/InfoCardContext'

interface HeadlineCardProps {
  accent: string
  label: string
  children: React.ReactNode
  foot?: React.ReactNode
  id?: string
  info?: CardInfo
  compact?: boolean
}

export function HeadlineCard({ accent, label, children, foot, id, info, compact = false }: HeadlineCardProps) {
  const cardId = id ?? `hc-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  const { isOpen, handleTap } = useCardInfoOverlay(cardId, info, accent)

  return (
    <div
      onClick={info ? handleTap : undefined}
      style={{
        position: 'relative', flex: 1,
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px 11px',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        cursor: info ? 'pointer' : 'default',
      }}
    >
      <Bracket color={accent} inset={6} op={0.4} radius={4} />
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.85,
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
      {isOpen && info && <InfoOverlay info={info} accent={accent} radius={10} compact={compact} onClick={handleTap} />}
    </div>
  )
}
