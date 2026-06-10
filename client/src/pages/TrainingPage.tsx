import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, SECTION_ACCENTS, CARD_SIZES, type CardInfo } from '../theme'
import { BRIEFS } from '../lib/stubData'
import { useTrainingData } from '../hooks/useTrainingData'
import { InfoCardProvider, useCardInfoOverlay, InfoOverlay } from '../lib/InfoCardContext'
import { HeadlineCard } from '../components/viz/HeadlineCard'
import { VitalTile } from '../components/viz/VitalTile'
import { Rail } from '../components/viz/Rail'
import { TrendRow } from '../components/viz/TrendRow'
import { StatusBanner } from '../components/viz/StatusBanner'
import { LoadBand } from '../components/viz/LoadBand'
import { IntensityBar } from '../components/viz/IntensityBar'
import { LogEntry } from '../components/viz/LogEntry'
import { Bars7 } from '../components/viz/Bars7'
import { ZoneDistribution } from '../components/viz/ZoneDistribution'
import { Bracket } from '../components/primitives/Bracket'
import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.training

const STATUS_INFO: CardInfo = {
  title: 'Training Status',
  description: "Garmin's classification of your recent load trajectory relative to your fitness trend. 'Productive' means load is building fitness. Updated after each workout.",
  source: 'Garmin Fenix 7X · Training Readiness',
}
const FITNESS_AGE_INFO: CardInfo = {
  title: 'Fitness Age',
  description: 'Your physiological age from VO2 Max compared to your demographic. Lower is better and can be decades below chronological age with consistent aerobic training.',
  source: 'Garmin Fenix 7X · VO2 Max algorithm',
}
const ACUTE_LOAD_INFO: CardInfo = {
  title: 'Acute Training Load',
  description: 'Weighted sum of training stress over the past 7 days. Staying within your optimal band builds fitness without raising injury risk.',
  source: 'Garmin Fenix 7X · activity import',
}
const LOAD_RATIO_INFO: CardInfo = {
  title: 'Load Ratio (ACWR)',
  description: 'Acute ÷ Chronic workload ratio. Optimal band 0.8–1.3. Above 1.5 is associated with 2–3× elevated injury risk in endurance athletes.',
  source: 'Bacta-computed · Garmin load data',
}
const INTENSITY_INFO: CardInfo = {
  title: 'Weekly Intensity Minutes',
  description: 'Moderate and vigorous minutes combined at 1:2 ratio. WHO recommends 150+ moderate or 75+ vigorous minutes weekly.',
  source: 'Garmin Fenix 7X · HR zone detection',
}
const ZONES_INFO: CardInfo = {
  title: 'HR Zone Distribution',
  description: 'Time in each intensity zone. Zone 2 builds aerobic base. Zone 4–5 builds threshold and VO2 Max. Most programs target 80% Z1-2 and 20% Z3-5 over a week.',
  source: 'Garmin Fenix 7X · optical HR + zones',
}
const STEPS_INFO: CardInfo = {
  title: 'Daily Steps',
  description: '8,000–10,000 steps/day is associated with significantly reduced all-cause mortality, independent of structured exercise.',
  source: 'Garmin Fenix 7X · accelerometer',
}

const STEPS_GOAL = 10000

function TrainingOverview() {
  const { data: TRN } = useTrainingData()
  const { isOpen: statusOpen, handleTap: statusTap } = useCardInfoOverlay('trn-status', STATUS_INFO, A)
  const { isOpen: ratioOpen, handleTap: ratioTap } = useCardInfoOverlay('trn-loadratio', LOAD_RATIO_INFO, A)
  const { isOpen: intensityOpen, handleTap: intensityTap } = useCardInfoOverlay('trn-intensity', INTENSITY_INFO, A)
  const { isOpen: zonesOpen, handleTap: zonesTap } = useCardInfoOverlay('trn-hrzones', ZONES_INFO, A)
  const { isOpen: stepsOpen, handleTap: stepsTap } = useCardInfoOverlay('trn-steps', STEPS_INFO, A)

  const totalZoneMins = TRN.hrZones.reduce((s, z) => s + z.mins, 0)
  const ratioColor = TRN.loadRatio?.state === 'Optimal' ? COLORS.green
    : TRN.loadRatio?.state === 'High' ? COLORS.amber : COLORS.textMuted

  const FA = typeof TRN.vo2max.fitnessAge === 'number' ? TRN.vo2max.fitnessAge : null
  const fitnessAgeLabel = FA == null ? null
    : FA <= 20 ? 'ELITE'
    : FA <= 30 ? 'EXCELLENT'
    : FA <= 40 ? 'GOOD'
    : FA <= 50 ? 'FAIR'
    : 'DEVELOPING'

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.training} />

      {/* Status banner */}
      <div onClick={statusTap} style={{ position: 'relative', marginBottom: 9, cursor: 'pointer', overflow: 'hidden', borderRadius: 9, minHeight: CARD_SIZES.row }}>
        <StatusBanner status={TRN.status.value} sub={TRN.status.sub} accent={A} />
        {statusOpen && <InfoOverlay info={STATUS_INFO} accent={A} radius={9} compact onClick={statusTap} />}
      </div>

      <Rail label="PERFORMANCE" accent={A} right="CURRENT" />

      {/* Fitness Age + Acute Load pair */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard accent={A} label="Fitness Age" info={FITNESS_AGE_INFO}
          foot={
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>VO2MAX</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: A }}>{TRN.vo2max.value}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>mL/kg</span>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 36, fontWeight: 700, color: A, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {typeof TRN.vo2max.fitnessAge === 'number' ? Math.round(TRN.vo2max.fitnessAge * 10) / 10 : TRN.vo2max.fitnessAge}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textMuted }}>yr</span>
          </div>
          {fitnessAgeLabel && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, padding: '2px 7px', borderRadius: 4, background: hexA(A, 0.1), border: `1px solid ${hexA(A, 0.35)}` }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: A, fontWeight: 700, letterSpacing: '0.06em' }}>{fitnessAgeLabel}</span>
            </div>
          )}
        </HeadlineCard>

        <HeadlineCard accent={A} label="Acute Load" info={ACUTE_LOAD_INFO}
          foot={<LoadBand value={TRN.load.value} low={TRN.load.low} high={TRN.load.high} accent={A} />}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 32, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {Math.round(TRN.load.value)}
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 8px', borderRadius: 4, background: hexA(A, 0.12), border: `1px solid ${hexA(A, 0.35)}` }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: A, fontWeight: 700, letterSpacing: '0.06em' }}>{TRN.load.state.toUpperCase()}</span>
          </div>
        </HeadlineCard>
      </div>

      {/* Load Ratio row */}
      {TRN.loadRatio && (
        <div onClick={ratioTap} style={{
          position: 'relative', background: COLORS.surface,
          border: `1px solid ${COLORS.line}`, borderRadius: 8,
          padding: '10px 14px', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: CARD_SIZES.row, marginBottom: 9, cursor: 'pointer',
        }}>
          <Bracket color={A} inset={6} op={0.35} radius={4} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary, letterSpacing: '0.12em', fontWeight: 600 }}>LOAD RATIO (ACWR)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: COLORS.text }}>{TRN.loadRatio.value.toFixed(2)}</span>
            <div style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 4, background: hexA(ratioColor, 0.12), border: `1px solid ${hexA(ratioColor, 0.4)}` }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: ratioColor }}>{TRN.loadRatio.state.toUpperCase()}</span>
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>{TRN.loadRatio.acute} ÷ {Math.round(TRN.loadRatio.chronic)}</span>
          </div>
          {ratioOpen && <InfoOverlay info={LOAD_RATIO_INFO} accent={A} radius={8} compact onClick={ratioTap} />}
        </div>
      )}

      <Rail label="INTENSITY THIS WEEK" accent={A} right={`GOAL ${TRN.intensity.goal} MIN`} />
      <div onClick={intensityTap} style={{ position: 'relative', marginBottom: 9, cursor: 'pointer', overflow: 'hidden', borderRadius: 9, minHeight: CARD_SIZES.row }}>
        <IntensityBar moderate={TRN.intensity.moderate} vigorous={TRN.intensity.vigorous} goal={TRN.intensity.goal} accent={A} />
        {intensityOpen && <InfoOverlay info={INTENSITY_INFO} accent={A} radius={9} compact onClick={intensityTap} />}
      </div>

      {/* HR Zones */}
      {TRN.hrZones.length > 0 && (
        <>
          <Rail label="HR ZONES" accent={A} right={`${Math.round(totalZoneMins)} MIN TODAY`} />
          <div onClick={zonesTap} style={{
            position: 'relative', background: COLORS.surface, border: `1px solid ${COLORS.line}`,
            borderRadius: 10, padding: '13px 14px 12px', overflow: 'hidden',
            minHeight: CARD_SIZES.bar, marginBottom: 9, cursor: 'pointer',
          }}>
            <Bracket color={A} inset={6} op={0.28} />
            <ZoneDistribution zones={TRN.hrZones} accent={A} />
            {zonesOpen && <InfoOverlay info={ZONES_INFO} accent={A} radius={10} onClick={zonesTap} />}
          </div>
        </>
      )}

      {/* Steps bar chart */}
      <Rail label="DAILY ACTIVITY" accent={A} right={TRN.dailyActivity.steps != null ? `${TRN.dailyActivity.steps.toLocaleString()} STEPS` : undefined} />
      {TRN.dailyActivity.stepsTrend.length > 0 && (
        <div onClick={stepsTap} style={{
          position: 'relative', background: COLORS.surface, border: `1px solid ${COLORS.line}`,
          borderRadius: 10, padding: '13px 14px 12px', overflow: 'hidden',
          minHeight: CARD_SIZES.bar, marginBottom: 9, cursor: 'pointer',
        }}>
          <Bracket color={A} inset={6} op={0.28} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>STEPS · 7 DAYS</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: TRN.dailyActivity.steps != null && TRN.dailyActivity.steps >= STEPS_GOAL ? COLORS.green : COLORS.textMuted }}>
              {TRN.dailyActivity.steps != null
                ? TRN.dailyActivity.steps >= STEPS_GOAL ? 'GOAL MET ◆' : `${(STEPS_GOAL - TRN.dailyActivity.steps).toLocaleString()} TO GO`
                : '—'}
            </span>
          </div>
          <Bars7 data={TRN.dailyActivity.stepsTrend} accent={A} h={80}
            fmt={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            goal={STEPS_GOAL} />
          {stepsOpen && <InfoOverlay info={STEPS_INFO} accent={A} radius={10} onClick={stepsTap} />}
        </div>
      )}

      {/* Daily tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
        {TRN.dailyActivity.distanceKm != null && (
          <VitalTile label="Distance" value={TRN.dailyActivity.distanceKm} unit="km" accent={A}
            info={{ description: 'GPS-tracked distance today across all activities.' }} />
        )}
        {TRN.dailyActivity.caloriesTotal != null && (
          <VitalTile label="Calories" value={TRN.dailyActivity.caloriesTotal} unit="kcal" accent={A}
            info={{ description: 'Basal metabolic rate plus active calories. Useful for tracking trends, not clinical precision.' }} />
        )}
        {TRN.dailyActivity.caloriesActive != null && (
          <VitalTile label="Active Cal" value={TRN.dailyActivity.caloriesActive} unit="kcal" accent={A}
            info={{ description: 'Calories from activity only, excluding resting metabolism. More directly reflects workout intensity.' }} />
        )}
        {TRN.dailyActivity.floors != null && (
          <VitalTile label="Floors" value={Math.round(TRN.dailyActivity.floors)} unit="fl" accent={A}
            info={{ description: 'Elevation gained via barometric altimeter. Tracks incidental vertical movement beyond step count.' }} />
        )}
      </div>

      <Rail label="ACTIVITY LOG" accent={A} right={TRN.activities.length > 0 ? `${TRN.activities.length} RECENT` : undefined} />
      {TRN.activities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TRN.activities.map(act => <LogEntry key={act.activity_id} activity={act} accent={A} />)}
        </div>
      ) : (
        <div style={{ background: hexA(A, 0.06), border: `1px solid ${hexA(A, 0.18)}`, borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em', color: COLORS.textMuted }}>CALIBRATING</span>
        </div>
      )}
    </>
  )
}

function TrainingTrends() {
  const { data: TRN } = useTrainingData()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {TRN.weeklyVolume && TRN.weeklyVolume.length > 0 && (
        <>
          <Rail label="WEEKLY VOLUME" accent={A} right="6 WEEKS · HOURS" />
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '13px 14px 11px', marginBottom: 9 }}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 10 }}>HOURS / WEEK</div>
            <Bars7 data={TRN.weeklyVolume.map(w => w.hours)} accent={A} h={70}
              labels={TRN.weeklyVolume.map(w => `W${parseInt(w.week.split('-')[1], 10)}`)}
              fmt={v => v.toFixed(1)} />
          </div>
        </>
      )}
      {TRN.activityHrByWeek && TRN.activityHrByWeek.length > 0 && (
        <>
          <Rail label="AVG ACTIVITY HR · 6 WEEKS" accent={A} right="DECLINING = IMPROVING" />
          <TrendRow
            label="Avg HR"
            value={TRN.activityHrByWeek[TRN.activityHrByWeek.length - 1].avg_hr}
            unit="bpm"
            data={TRN.activityHrByWeek.map(w => w.avg_hr)}
            accent={A}
            delta={TRN.activityHrByWeek[TRN.activityHrByWeek.length - 1].avg_hr - TRN.activityHrByWeek[0].avg_hr}
            lowerBetter
            kind="bars"
          />
        </>
      )}
      {TRN.load.trend.length > 0 && (
        <TrendRow label="Load" value={TRN.load.value} data={TRN.load.trend} accent={A} kind="bars" />
      )}
      {TRN.vo2max.trend.length > 0 && (
        <TrendRow label="VO2 Max" value={TRN.vo2max.value} unit="mL/kg" data={TRN.vo2max.trend} accent={A} delta={TRN.vo2max.delta} />
      )}
      {TRN.intensity.trend.length > 0 && (
        <TrendRow label="Intensity" value={`${TRN.intensity.moderate + TRN.intensity.vigorous * 2}`} unit="pts" data={TRN.intensity.trend} accent={A} kind="bars" />
      )}
      {TRN.dailyActivity.stepsTrend.length > 0 && (
        <TrendRow label="Steps" value={TRN.dailyActivity.steps != null ? TRN.dailyActivity.steps.toLocaleString() : 0} data={TRN.dailyActivity.stepsTrend} accent={A} kind="bars" />
      )}
      {TRN.dailyActivity.calTrend.length > 0 && (
        <TrendRow label="Calories" value={TRN.dailyActivity.caloriesTotal ?? 0} unit="kcal" data={TRN.dailyActivity.calTrend} accent={A} kind="bars" />
      )}
    </div>
  )
}

function TrainingContent() {
  const tab = useTab()
  return (
    <InfoCardProvider>
      {tab === 'overview' ? <TrainingOverview /> : <TrainingTrends />}
    </InfoCardProvider>
  )
}

export function TrainingPage() {
  return (
    <AppShell section="training" hasTabs>
      <TrainingContent />
    </AppShell>
  )
}
