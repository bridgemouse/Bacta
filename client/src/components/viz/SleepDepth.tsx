import { hexA } from '../../lib/hexA'
import { COLORS, FONT_MONO } from '../../theme'

interface SleepDepthProps {
  hypno: number[]
  accent: string
  w?: number
  h?: number
}

/** Filled topographic area chart of sleep depth over the night (deeper = lower). */
export function SleepDepth({ hypno, accent, w = 334, h = 86 }: SleepDepthProps) {
  const padT = 6, padB = 4
  const ih = h - padT - padB
  const n = hypno.length
  const x = (i: number) => (i / n) * w
  const y = (lv: number) => padT + (lv / 3) * ih  // deeper = lower on chart

  let line = ''
  hypno.forEach((lv, i) => {
    const yy = y(lv)
    line += (i === 0 ? `M0 ${yy}` : `L${x(i)} ${yy}`) + ` L${x(i + 1)} ${yy}`
  })
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const gradId = 'sleepDepthGrad'

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.05" />
          <stop offset="1" stopColor="#7c5cff" stopOpacity="0.42" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map(lv => (
        <line key={lv} x1="0" y1={y(lv)} x2={w} y2={y(lv)}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {(['AWAKE', 'REM', 'LIGHT', 'DEEP'] as const).map((label, lv) => (
        <text key={label} x={2} y={lv === 0 ? y(0) + 8 : y(lv) - 2}
          fontSize={6} fontFamily={FONT_MONO} fill={COLORS.textMuted} opacity={0.55}>
          {label}
        </text>
      ))}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.8" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${hexA(accent, 0.5)})` }} />
    </svg>
  )
}
