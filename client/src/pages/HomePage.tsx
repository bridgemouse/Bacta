import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { TransmissionPanel } from '../components/MX4Card'
import { SystemCard } from '../components/MetricTile'
import type { SystemCardTile } from '../components/MetricTile'
import { COLORS, MX4_COLOR, FONT_MONO } from '../theme'

const ASSESSMENT =
  'Recovery is solid and trending up. Training load is on track for week four. Nutrition is close — protein is the only gap worth closing tonight.'

const TILES: SystemCardTile[] = [
  {
    key: 'recovery',
    value: '74',
    unit: 'battery',
    sub: 'HRV ↑ 61ms',
    viz: 'spark',
    spark: [50, 54, 49, 57, 55, 60, 66, 74],
    status: 'Good',
  },
  {
    key: 'training',
    value: '342',
    unit: 'load',
    sub: 'Moderate · wk 4 / 8',
    viz: 'spark',
    spark: [280, 300, 260, 320, 340, 310, 330, 342],
    status: 'On track',
  },
  {
    key: 'sleep',
    value: '8.1',
    unit: 'h',
    sub: 'Score 82',
    viz: 'ring',
    ring: 0.82,
    status: 'Solid',
  },
  {
    key: 'nutrition',
    value: '2,340',
    unit: 'kcal',
    sub: 'Protein 142 / 160g',
    viz: 'ring',
    ring: 0.94,
    status: 'On target',
  },
  {
    key: 'bloodwork',
    value: 'Clear',
    unit: '',
    sub: 'No flags · 0 panels',
    viz: 'shield',
    status: 'Nominal',
  },
  {
    key: 'dailylog',
    value: '4',
    unit: '/ 5',
    sub: 'Logged today',
    viz: 'dots',
    dots: 4,
    status: 'Logged',
  },
]

export function HomePage() {
  const navigate = useNavigate()

  return (
    <AppShell section="home">
      <TransmissionPanel
        accent={MX4_COLOR}
        mood="transmit"
        label="INCOMING // MX-4"
        assessment={ASSESSMENT}
      />

      {/* SYSTEMS rail */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 11,
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: MX4_COLOR,
          }}
        >
          SYSTEMS
        </span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, ${MX4_COLOR}44, transparent)`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.1em',
            color: COLORS.textMuted,
          }}
        >
          6 ONLINE
        </span>
      </div>

      {/* SystemCard grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {TILES.map((tile, i) => (
          <SystemCard
            key={tile.key}
            tile={tile}
            index={i + 1}
            onClick={() => navigate(`/${tile.key}`)}
          />
        ))}
      </div>
    </AppShell>
  )
}
