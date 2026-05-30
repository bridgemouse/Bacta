import { useId } from 'react'

interface SparklineProps {
  data: number[]
  accent: string
  w?: number
  h?: number
  sw?: number
  fill?: boolean
  dot?: boolean
}

export function Sparkline({ data, accent, w = 92, h = 30, sw = 1.8, fill = true, dot = true }: SparklineProps) {
  if (data.length === 0) {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} />
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const rng = max - min || 1
  const pts = data.map((d, i) => [
    (i / Math.max(data.length - 1, 1)) * w,
    h - 3 - ((d - min) / rng) * (h - 6),
  ])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const id = 'sg' + useId().replace(/:/g, '')
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.28" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={accent} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {dot && <circle cx={last[0]} cy={last[1]} r={2.4} fill={accent} />}
    </svg>
  )
}
