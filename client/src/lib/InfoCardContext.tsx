import { createContext, useContext, useState, useEffect } from 'react'
import { COLORS, FONT_MONO, FONT_UI, type CardInfo } from '../theme'
import { hexA } from './hexA'

interface InfoCardContextValue {
  openId: string | null
  open: (id: string) => void
  close: () => void
}

const InfoCardContext = createContext<InfoCardContextValue>({
  openId: null, open: () => {}, close: () => {},
})

export function InfoCardProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <InfoCardContext.Provider value={{ openId, open: setOpenId, close: () => setOpenId(null) }}>
      {children}
    </InfoCardContext.Provider>
  )
}

export function useCardInfoOverlay(id: string, info: CardInfo | undefined, _accent: string) {
  const { openId, open, close } = useContext(InfoCardContext)
  const isOpen = openId === id && info != null

  useEffect(() => {
    if (!isOpen) return
    const dismiss = () => close()
    const t = setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 30)
    return () => { clearTimeout(t); document.removeEventListener('click', dismiss) }
  }, [isOpen, close])

  const handleTap = (e: React.MouseEvent | { stopPropagation: () => void }) => {
    if (!info) return
    e.stopPropagation()
    isOpen ? close() : open(id)
  }

  return { isOpen, handleTap }
}

interface InfoOverlayProps {
  info: CardInfo
  accent: string
  radius?: number
  compact?: boolean
  onClick: (e: React.MouseEvent) => void
}

export function InfoOverlay({ info, accent, radius = 10, compact = false, onClick }: InfoOverlayProps) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: `linear-gradient(145deg, ${hexA(accent, 0.32)}, ${hexA(accent, 0.12)})`,
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        borderRadius: radius,
        border: `1px solid ${hexA(accent, 0.55)}`,
        padding: compact ? '9px 13px' : '10px 14px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: compact ? 4 : 7,
        overflow: 'hidden', cursor: 'pointer',
      }}
    >
      {!compact && info.title && (
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700,
          letterSpacing: '0.13em', color: accent, textAlign: 'center', lineHeight: 1,
        }}>
          {info.title.toUpperCase()}
        </span>
      )}
      <p style={{
        margin: 0, fontFamily: FONT_UI,
        fontSize: compact ? 11.5 : 12,
        fontStyle: 'italic', lineHeight: compact ? 1.45 : 1.5,
        color: 'rgba(255,255,255,0.90)', textAlign: 'center',
        overflow: 'hidden', flex: 1,
        display: 'flex', alignItems: 'center',
      }}>
        {info.description}
      </p>
      {!compact && info.source && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 7, letterSpacing: '0.08em', color: hexA(accent, 0.5) }}>SOURCE</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: hexA(accent, 0.8) }}>{info.source}</span>
        </div>
      )}
    </div>
  )
}

// Re-export COLORS so callers can use it without importing theme directly if needed
export { COLORS }
