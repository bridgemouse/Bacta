import type { CSSProperties } from 'react'

interface BracketProps {
  color: string
  size?: number
  sw?: number
  op?: number
  inset?: number
  radius?: number
}

export function Bracket({ color, size = 11, sw = 1.4, op = 0.55, inset = 7, radius = 4 }: BracketProps) {
  const base: CSSProperties = { position: 'absolute', width: size, height: size, pointerEvents: 'none', opacity: op }
  const mk = (extra: CSSProperties): CSSProperties => ({ ...base, ...extra })
  return (
    <>
      <span style={mk({ top: inset, left: inset, borderTop: `${sw}px solid ${color}`, borderLeft: `${sw}px solid ${color}`, borderTopLeftRadius: radius })} />
      <span style={mk({ top: inset, right: inset, borderTop: `${sw}px solid ${color}`, borderRight: `${sw}px solid ${color}`, borderTopRightRadius: radius })} />
      <span style={mk({ bottom: inset, left: inset, borderBottom: `${sw}px solid ${color}`, borderLeft: `${sw}px solid ${color}`, borderBottomLeftRadius: radius })} />
      <span style={mk({ bottom: inset, right: inset, borderBottom: `${sw}px solid ${color}`, borderRight: `${sw}px solid ${color}`, borderBottomRightRadius: radius })} />
    </>
  )
}
