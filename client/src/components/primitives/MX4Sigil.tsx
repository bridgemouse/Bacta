import type { CSSProperties } from 'react'

export type MX4Mood = 'transmit' | 'idle' | 'listen' | 'think' | 'alert' | 'pleased'

interface MX4SigilProps {
  color?: string
  size?: number
  spin?: boolean
  glow?: boolean
  mood?: MX4Mood
}

export function MX4Sigil({ color = '#4ade80', size = 40, spin = false, glow = false, mood = 'transmit' }: MX4SigilProps) {
  const spinStyle: CSSProperties | undefined = spin
    ? { transformOrigin: '24px 24px', animation: 'mx4spin 14s linear infinite' }
    : undefined
  const spinStyleRev: CSSProperties | undefined = spin
    ? { transformOrigin: '24px 24px', animation: 'mx4spin 18s linear infinite reverse' }
    : undefined

  const F = (
    <polygon
      points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14"
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      strokeOpacity="0.5"
    />
  )
  const Ffaint = (
    <polygon
      points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14"
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      strokeOpacity="0.32"
    />
  )
  const core = <circle cx="24" cy="24" r="3.4" fill={color} />
  const coreSm = <circle cx="24" cy="24" r="2.6" fill={color} />

  let inner: JSX.Element
  switch (mood) {
    case 'idle':
      inner = (
        <>
          <circle cx="24" cy="24" r="11" fill="none" stroke={color} strokeWidth="1.3" strokeOpacity="0.5" />
          <line x1="5.5" y1="24" x2="9" y2="24" stroke={color} strokeWidth="1.3" strokeOpacity="0.4" strokeLinecap="round" />
          <line x1="39" y1="24" x2="42.5" y2="24" stroke={color} strokeWidth="1.3" strokeOpacity="0.4" strokeLinecap="round" />
          {coreSm}
          <circle cx="24" cy="24" r="6" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.3" />
        </>
      )
      break
    case 'listen':
      inner = (
        <>
          {Ffaint}
          <path d="M8.5 24 Q24 13 39.5 24 Q24 35 8.5 24 Z" fill="none" stroke={color} strokeWidth="1.6" strokeOpacity="0.9" />
          <circle cx="24" cy="24" r="7.5" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.32" />
          <circle cx="24" cy="24" r="4" fill={color} />
        </>
      )
      break
    case 'think':
      inner = (
        <>
          {F}
          <g style={spinStyleRev}>
            <circle cx="24" cy="24" r="12.5" fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="3 7" strokeLinecap="round" strokeOpacity="0.85" />
          </g>
          <line x1="15" y1="24" x2="33" y2="24" stroke={color} strokeWidth="1.4" strokeDasharray="2.5 2.5" strokeOpacity="0.8" />
          <circle cx="24" cy="24" r="2.6" fill={color} />
        </>
      )
      break
    case 'alert':
      inner = (
        <>
          {F}
          <circle cx="24" cy="24" r="9.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.85" />
          <rect x="22.5" y="17.5" width="3" height="13" rx="1.5" fill={color} />
        </>
      )
      break
    case 'pleased':
      inner = (
        <>
          {F}
          <circle cx="24" cy="24" r="9.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.8" />
          <path d="M18.5 26.5 Q24 20.5 29.5 26.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="28.5" r="1.8" fill={color} />
        </>
      )
      break
    case 'transmit':
    default:
      inner = (
        <>
          {F}
          <g style={spinStyle}>
            <circle cx="24" cy="24" r="13" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 9" strokeLinecap="round" strokeOpacity="0.9" />
          </g>
          <circle cx="24" cy="24" r="8.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.85" />
          {core}
          <circle cx="24" cy="24" r="6" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.4" />
        </>
      )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {glow && (
          <filter id="mx4glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g filter={glow ? 'url(#mx4glow)' : undefined}>{inner}</g>
    </svg>
  )
}
