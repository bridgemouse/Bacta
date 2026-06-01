import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../theme'
import { BRIEFS } from '../lib/stubData'
import { useTrainingData } from '../hooks/useTrainingData'
import { Gauge } from '../components/viz/Gauge'
import { Delta } from '../components/viz/Delta'
import { HeadlineCard } from '../components/viz/HeadlineCard'
import { Rail } from '../components/viz/Rail'
import { TrendRow } from '../components/viz/TrendRow'
import { StatusBanner } from '../components/viz/StatusBanner'
import { LoadBand } from '../components/viz/LoadBand'
import { IntensityBar } from '../components/viz/IntensityBar'
import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.training

function TrainingOverview() {
  const { data: TRN } = useTrainingData()
  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.training} />

      <StatusBanner
        status={TRN.status.value}
        sub={TRN.status.sub}
        accent={A}
      />

      {/* VO2 Max */}
      <div style={{ marginTop: 9, marginBottom: 9 }}>
        <HeadlineCard
          accent={A}
          label="VO2 Max"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
              Fitness age {TRN.vo2max.fitnessAge}
            </span>
          }
        >
          <Gauge value={TRN.vo2max.value} max={70} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 24, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {TRN.vo2max.value}
            </span>
            <Delta value={TRN.vo2max.delta} size={9} />
          </Gauge>
        </HeadlineCard>
      </div>

      {/* Acute Load */}
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '12px 13px', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>ACUTE LOAD</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: A }}>{TRN.load.state.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1, display: 'block', marginBottom: 10 }}>
          {TRN.load.value}
        </span>
        <LoadBand value={TRN.load.value} low={TRN.load.low} high={TRN.load.high} accent={A} />
      </div>

      <Rail label="INTENSITY THIS WEEK" accent={A} right={`GOAL ${TRN.intensity.goal} MIN`} />

      <IntensityBar
        moderate={TRN.intensity.moderate}
        vigorous={TRN.intensity.vigorous}
        goal={TRN.intensity.goal}
        accent={A}
      />

      <Rail label="ACTIVITY LOG" accent={A} />

      <div style={{
        background: hexA(A, 0.06), border: `1px solid ${hexA(A, 0.18)}`,
        borderRadius: 10, padding: '20px 16px', textAlign: 'center',
      }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em', color: COLORS.textMuted }}>
          CALIBRATING
        </span>
      </div>
    </>
  )
}

function TrainingTrends() {
  const { data: TRN } = useTrainingData()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <TrendRow
        label="Load" value={TRN.load.value}
        data={TRN.load.trend} accent={A} kind="bars"
      />
      <TrendRow
        label="VO2 Max" value={TRN.vo2max.value} unit="mL/kg"
        data={TRN.status.trend} accent={A}
        delta={TRN.vo2max.delta}
      />
      <TrendRow
        label="Intensity" value={`${TRN.intensity.moderate + TRN.intensity.vigorous * 2}`} unit="pts"
        data={TRN.intensity.trend} accent={A} kind="bars"
      />
    </div>
  )
}

function TrainingContent() {
  const tab = useTab()
  return tab === 'overview' ? <TrainingOverview /> : <TrainingTrends />
}

export function TrainingPage() {
  return (
    <AppShell section="training" hasTabs>
      <TrainingContent />
    </AppShell>
  )
}
