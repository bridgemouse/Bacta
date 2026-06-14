import type { ReactElement } from 'react'
import type { SectionKey } from '../../theme'

interface SigilProps {
  name: Exclude<SectionKey, 'home'>
  color?: string
  size?: number
  sw?: number
}

export function Sigil({ name, color = '#fff', size = 18, sw = 1.6 }: SigilProps) {
  const p = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const shapes: Record<Exclude<SectionKey, 'home'>, ReactElement> = {
    recovery: (
      <g {...p}>
        <circle cx="12" cy="12" r="7.5" strokeDasharray="34 13" transform="rotate(-90 12 12)" />
        <circle cx="12" cy="12" r="1.7" fill={color} stroke="none" />
      </g>
    ),
    training: (
      <g {...p}>
        <polyline points="6,13 12,8 18,13" />
        <polyline points="6,17 12,12 18,17" />
      </g>
    ),
    sleep: (
      <g {...p}>
        <path d="M16.5 13.2A6 6 0 1 1 10.8 6.5 4.7 4.7 0 0 0 16.5 13.2Z" />
      </g>
    ),
    nutrition: (
      <g {...p}>
        <polygon points="12,4.5 18.5,8.2 18.5,15.8 12,19.5 5.5,15.8 5.5,8.2" />
      </g>
    ),
    bloodwork: (
      <g {...p}>
        <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" transform="rotate(45 12 12)" />
        <line x1="8.8" y1="12" x2="15.2" y2="12" />
      </g>
    ),
    dailylog: (
      <g {...p}>
        <line x1="6" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="15" y2="12" />
        <line x1="6" y1="16" x2="12" y2="16" />
      </g>
    ),
    settings: (
      <g {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </g>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {shapes[name]}
    </svg>
  )
}
