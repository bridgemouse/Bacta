import { useState, useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { COLORS, FONT_MONO } from '../theme'
import { hexA } from '../lib/hexA'
import { bactaTexture } from '../lib/bactaTexture'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxHeight?: string
}

export function Sheet({ open, onClose, children, maxHeight = '82%' }: SheetProps) {
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    } else {
      setShown(false)
      const t = setTimeout(() => setRender(false), 340)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!render) return null

  return (
    <div
      data-testid="sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: shown ? 'rgba(6,9,14,0.62)' : 'rgba(6,9,14,0)',
        transition: 'background .34s ease',
        backdropFilter: shown ? 'blur(3px)' : 'blur(0px)',
        WebkitBackdropFilter: shown ? 'blur(3px)' : 'blur(0px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight,
          transform: shown ? 'translateY(0)' : 'translateY(101%)',
          transition: 'transform .36s cubic-bezier(.22,.61,.36,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface SheetShellProps {
  accent: string
  children: ReactNode
  onClose?: () => void
}

const DRAG_DISMISS_THRESHOLD = 80

export function SheetShell({ accent, children, onClose }: SheetShellProps) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startYRef = useRef(0)

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    setDragging(true)
    startYRef.current = e.clientY
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    setDragY(Math.max(0, e.clientY - startYRef.current))
  }

  function handlePointerUp() {
    if (!dragging) return
    setDragging(false)
    if (dragY > DRAG_DISMISS_THRESHOLD) {
      onClose?.()
      // Sheet only unmounts SheetShell ~340ms after close, so a quick reopen
      // within that window would otherwise render with this drag offset still
      // applied. Clear it after the close transition finishes rather than
      // immediately, so the dismiss animation itself isn't disturbed.
      setTimeout(() => setDragY(0), 300)
    } else {
      setDragY(0)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        background: COLORS.base,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTop: `1px solid ${hexA(accent, 0.4)}`,
        boxShadow: `0 -18px 50px rgba(0,0,0,0.5), 0 0 40px ${hexA(accent, 0.07)}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100%',
        color: COLORS.text,
        transform: `translateY(${dragY}px)`,
        transition: dragging ? 'none' : 'transform 0.25s ease',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, ...bactaTexture(accent), pointerEvents: 'none', opacity: 0.7 }}
      />
      {/* Grab handle — drag down to dismiss */}
      <div
        data-testid="sheet-drag-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 9,
          paddingBottom: 8,
          touchAction: 'none',
          cursor: 'grab',
        }}
      >
        <span style={{ width: 38, height: 4, borderRadius: 4, background: hexA(accent, 0.4) }} />
      </div>
      {children}
    </div>
  )
}

interface SheetHeaderProps {
  accent: string
  sigil: ReactNode
  title: string
  sub?: string
  onClose: () => void
  actions?: ReactNode
}

export function SheetHeader({ accent, sigil, title, sub, onClose, actions }: SheetHeaderProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 18px 12px' }}>
      {sigil}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>
          {title}
        </span>
        {sub && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sub}
          </span>
        )}
      </div>
      {actions}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `1px solid ${COLORS.line}`,
          background: COLORS.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2.4" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}
