import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { SystemCard } from '../components/MetricTile'
import type { SystemCardTile } from '../components/MetricTile'
import { useTab } from '../lib/TabContext'
import { BRIEFS, RECOVERY, SLEEP, TRAINING } from '../lib/stubData'
import { COLORS, MX4_COLOR, SECTION_ACCENTS, FONT_MONO } from '../theme'
import { TrendRow } from '../components/viz/TrendRow'
import { Rail } from '../components/viz/Rail'

const TILES: SystemCardTile[] = [
  { key: 'recovery', value: '74',    unit: 'battery', sub: 'HRV ↑ 61ms',         viz: 'spark', spark: [50,54,49,57,55,60,66,74], status: 'Good' },
  { key: 'training', value: '342',   unit: 'load',    sub: 'Moderate · wk 4 / 8', viz: 'spark', spark: [280,300,260,320,340,310,330,342], status: 'On track' },
  { key: 'sleep',    value: '8.1',   unit: 'h',       sub: 'Score 82',            viz: 'ring',  ring: 0.82, status: 'Solid' },
  { key: 'nutrition', value: '',     unit: '',        sub: '', viz: 'spark', status: '', calibrating: true },
  { key: 'bloodwork', value: '',     unit: '',        sub: '', viz: 'spark', status: '', calibrating: true },
  { key: 'dailylog',  value: '',     unit: '',        sub: '', viz: 'spark', status: '', calibrating: true },
]

const A = MX4_COLOR

function HomeOverview({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.home} />

      <Rail label="SYSTEMS" accent={A} right="3 ONLINE · 3 CALIBRATING" />

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
  const REC  = SECTION_ACCENTS.recovery
  const SLP  = SECTION_ACCENTS.sleep
  const TRN  = SECTION_ACCENTS.training

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.home} />
      <Rail label="WEEK IN REVIEW" accent={A} right="3 CHANNELS" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <TrendRow
          label="Recovery" value={RECOVERY.score.value}
          data={RECOVERY.score.trend} accent={REC}
          delta={RECOVERY.score.value - RECOVERY.score.trend[5]}
        />
        <TrendRow
          label="HRV" value={RECOVERY.hrv.value} unit="ms"
          data={RECOVERY.hrv.trend} accent={REC}
          delta={RECOVERY.hrv.value - RECOVERY.hrv.avg}
        />
        <TrendRow
          label="Sleep" value={SLEEP.score.value}
          data={SLEEP.score.trend} accent={SLP}
          delta={SLEEP.score.value - SLEEP.score.trend[5]}
        />
        <TrendRow
          label="Training Load" value={TRAINING.load.value}
          data={TRAINING.load.trend} accent={TRN} kind="bars"
          delta={TRAINING.load.value - TRAINING.load.trend[5]}
        />
        <TrendRow
          label="Intensity" value={TRAINING.intensity.moderate + TRAINING.intensity.vigorous * 2} unit="min"
          data={TRAINING.intensity.trend} accent={TRN} kind="bars"
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
