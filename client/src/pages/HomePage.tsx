import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { SystemCard } from '../components/MetricTile'
import type { SystemCardTile } from '../components/MetricTile'
import { useTab } from '../lib/TabContext'
import { BRIEFS } from '../lib/stubData'
import { useBriefing } from '../hooks/useBriefing'
import { MX4_COLOR, SECTION_ACCENTS } from '../theme'
import { TrendRow } from '../components/viz/TrendRow'
import { Rail } from '../components/viz/Rail'
import { useHomeData } from '../hooks/useHomeData'
import { useRecoveryData } from '../hooks/useRecoveryData'
import { useSleepData } from '../hooks/useSleepData'
import { useTrainingData } from '../hooks/useTrainingData'

const CALIBRATING_TILES: SystemCardTile[] = [
  { key: 'nutrition', value: '', unit: '', sub: '', viz: 'spark', status: '', calibrating: true },
  { key: 'bloodwork', value: '', unit: '', sub: '', viz: 'spark', status: '', calibrating: true },
  { key: 'dailylog',  value: '', unit: '', sub: '', viz: 'spark', status: '', calibrating: true },
]

const A = MX4_COLOR

function HomeOverview({ onNavigate, liveData, onRefresh }: { onNavigate: (path: string) => void; liveData?: import('../lib/briefing').BriefingResult; onRefresh?: () => void }) {
  const { data: home } = useHomeData()

  const LIVE_TILES: SystemCardTile[] = [
    {
      key: 'recovery',
      value: home.recovery.value,
      unit: 'battery',
      sub: home.recovery.sub,
      viz: 'spark',
      spark: [50, 54, 49, 57, 55, 60, 66, 74],
      status: 'Good',
    },
    {
      key: 'training',
      value: home.training.value,
      unit: 'load',
      sub: home.training.sub,
      viz: 'spark',
      spark: [280, 300, 260, 320, 340, 310, 330, 342],
      status: home.training.sub,
    },
    {
      key: 'sleep',
      value: home.sleep.value,
      unit: home.sleep.value.includes('h') ? '' : 'h',
      sub: home.sleep.sub,
      viz: 'ring',
      ring: home.sleep.ring,
      status: 'Solid',
    },
  ]
  const TILES = [...LIVE_TILES, ...CALIBRATING_TILES]

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.home} liveData={liveData} section="home" onRefresh={onRefresh} />

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

function HomeTrends({ liveData, onRefresh }: { liveData?: import('../lib/briefing').BriefingResult; onRefresh?: () => void }) {
  const REC  = SECTION_ACCENTS.recovery
  const SLP  = SECTION_ACCENTS.sleep
  const TRN  = SECTION_ACCENTS.training

  const { data: rec } = useRecoveryData()
  const { data: slp } = useSleepData()
  const { data: trn } = useTrainingData()

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.home} liveData={liveData} section="home" onRefresh={onRefresh} />
      <Rail label="WEEK IN REVIEW" accent={A} right="3 CHANNELS" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <TrendRow
          label="Recovery" value={rec.score.value}
          data={rec.score.trend} accent={REC}
          delta={rec.score.trend.length >= 6 ? rec.score.value - rec.score.trend[5] : undefined}
        />
        <TrendRow
          label="HRV" value={rec.hrv.value} unit="ms"
          data={rec.hrv.trend} accent={REC}
          delta={rec.hrv.avg != null ? rec.hrv.value - rec.hrv.avg : undefined}
        />
        <TrendRow
          label="Sleep" value={slp.score.value}
          data={slp.score.trend} accent={SLP}
          delta={slp.score.trend.length >= 6 ? slp.score.value - slp.score.trend[5] : undefined}
        />
        <TrendRow
          label="Training Load" value={trn.load.value}
          data={trn.load.trend} accent={TRN} kind="bars"
          delta={trn.load.trend.length >= 6 ? trn.load.value - trn.load.trend[5] : undefined}
        />
        <TrendRow
          label="Intensity" value={trn.intensity.moderate + trn.intensity.vigorous * 2} unit="min"
          data={trn.intensity.trend} accent={TRN} kind="bars"
        />
      </div>
    </>
  )
}

function HomeContent({ onNavigate }: { onNavigate: (path: string) => void }) {
  const tab = useTab()
  const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('home')
  return tab === 'overview'
    ? <HomeOverview onNavigate={onNavigate} liveData={liveBriefing ?? undefined} onRefresh={refreshBriefing} />
    : <HomeTrends liveData={liveBriefing ?? undefined} onRefresh={refreshBriefing} />
}

export function HomePage() {
  const navigate = useNavigate()

  return (
    <AppShell section="home" hasTabs>
      <HomeContent onNavigate={navigate} />
    </AppShell>
  )
}
