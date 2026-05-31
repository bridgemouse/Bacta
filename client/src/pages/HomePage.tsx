import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { SystemCard } from '../components/MetricTile'
import type { SystemCardTile } from '../components/MetricTile'
import { useTab } from '../lib/TabContext'
import { BRIEFS, RECOVERY, SLEEP, TRAINING } from '../lib/stubData'
import { COLORS, MX4_COLOR, FONT_MONO } from '../theme'
import { TrendRow } from '../components/viz/TrendRow'
import { Rail } from '../components/viz/Rail'

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

const A = MX4_COLOR

function HomeOverview({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.home} />

      {/* SYSTEMS rail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: A }}>
          SYSTEMS
        </span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${A}44, transparent)` }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.1em', color: COLORS.textMuted }}>
          6 ONLINE
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {TILES.map((tile, i) => (
          <SystemCard
            key={tile.key}
            tile={tile}
            index={i + 1}
            onClick={() => onNavigate(`/${tile.key}`)}
          />
        ))}
      </div>
    </>
  )
}

function HomeTrends() {
  return (
    <>
      <Rail label="CROSS-SECTION TRENDS" accent={A} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <TrendRow
          label="Recovery" value={RECOVERY.score.value}
          data={RECOVERY.score.trend} accent={A}
        />
        <TrendRow
          label="Sleep Score" value={SLEEP.score.value}
          data={SLEEP.score.trend} accent={A}
        />
        <TrendRow
          label="HRV" value={RECOVERY.hrv.value} unit="ms"
          data={RECOVERY.hrv.trend} accent={A}
          delta={RECOVERY.hrv.value - RECOVERY.hrv.avg}
        />
        <TrendRow
          label="Training Load" value={TRAINING.load.value}
          data={TRAINING.load.trend} accent={A} kind="bars"
        />
        <TrendRow
          label="VO2 Max" value={TRAINING.vo2max.value} unit="mL/kg"
          data={TRAINING.status.trend} accent={A}
        />
      </div>
    </>
  )
}

function HomeContent({ onNavigate }: { onNavigate: (path: string) => void }) {
  const tab = useTab()
  return tab === 'overview'
    ? <HomeOverview onNavigate={onNavigate} />
    : <HomeTrends />
}

export function HomePage() {
  const navigate = useNavigate()

  return (
    <AppShell section="home" hasTabs>
      <HomeContent onNavigate={navigate} />
    </AppShell>
  )
}
