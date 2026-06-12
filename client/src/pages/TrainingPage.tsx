import type { CSSProperties } from 'react'
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
import { Sparkline } from '../components/primitives/Sparkline'
import { hexA } from '../lib/hexA'

const A = SECTION_ACCENTS.training

const STATUS_INFO: CardInfo = {
  title: 'Training Status',
  description: "Garmin's classification of your recent load trajectory relative to your fitness trend. 'Productive' means load is building fitness. Updated after each workout.",
  source: 'Garmin Venu 4 · Training Readiness',
}
const FITNESS_AGE_INFO: CardInfo = {
  title: 'Fitness Age',
  description: 'Your physiological age from VO2 Max compared to your demographic. Lower is better and can be decades below chronological age with consistent aerobic training.',
  source: 'Garmin Venu 4 · VO2 Max algorithm',
}
const ACUTE_LOAD_INFO: CardInfo = {
  title: 'Acute Training Load',
  description: 'Weighted sum of training stress over the past 7 days. Staying within your optimal band builds fitness without raising injury risk.',
  source: 'Garmin Venu 4 · activity import',
}
const LOAD_RATIO_INFO: CardInfo = {
  title: 'Load Ratio (ACWR)',
  description: 'Acute ÷ Chronic workload ratio. Optimal 0.8-1.3. Above 1.5 raises injury risk 2 - 3x.',
  source: 'Bacta-computed · Garmin load data',
}
const INTENSITY_INFO: CardInfo = {
  title: 'Weekly Intensity Minutes',
  description: 'Moderate + vigorous at 1:2 ratio. WHO recommends 150+ moderate or 75+ vigorous weekly.',
  source: 'Garmin Venu 4 · HR zone detection',
}
const ZONES_INFO: CardInfo = {
  title: 'HR Zone Distribution',
  description: 'Time in each intensity zone. Zone 2 builds aerobic base. Zone 4–5 builds threshold and VO2 Max. Most programs target 80% Z1-2 and 20% Z3-5 over a week.',
  source: 'Garmin Venu 4 · optical HR + zones',
}
const STEPS_INFO: CardInfo = {
  title: 'Daily Steps',
  description: '8,000–10,000 steps/day is associated with significantly reduced all-cause mortality, independent of structured exercise.',
  source: 'Garmin Venu 4 · accelerometer',
}
const LOAD_TREND_INFO: CardInfo = {
  title: 'Training Load · 7 Days',
  description: 'Weighted training stress over the past 7 days. Staying within your optimal band builds fitness without raising injury risk.',
  source: 'Garmin Venu 4 · activity import',
}
const VOL_INFO: CardInfo = {
  title: 'Weekly Training Volume',
  description: 'Total training hours per calendar week across all activity types. Look for planned step-backs (deload weeks) and progressive overload cycles.',
  source: 'Garmin Venu 4 · all activity types',
}
const FA_TREND_INFO: CardInfo = {
  title: 'Fitness Age · 30 Days',
  description: 'Your physiological age estimated from VO2 Max relative to your demographic. A downward trend means aerobic capacity is improving. A rising trend signals detraining.',
  source: 'Garmin Venu 4 · VO2 Max algorithm',
}
const ACTHR_INFO: CardInfo = {
  title: 'Avg Activity Heart Rate',
  description: 'Weekly avg HR across all workout sessions. A declining trend at the same effort signals improving cardiovascular efficiency — the hallmark of aerobic adaptation.',
  source: 'Garmin Venu 4 · optical HR',
}
const VO2MAX_TREND_INFO: CardInfo = {
  title: 'VO2 Max · 30 Days',
  description: 'Aerobic capacity in mL O₂/kg/min. Builds with consistent zone 2–4 training. 30-day view shows the trajectory as new workouts register.',
  source: 'Garmin Venu 4 · VO2 Max algorithm',
}
const INTENSITY_TREND_INFO: CardInfo = {
  title: 'Intensity Minutes · 7 Days',
  description: 'Daily vigorous intensity minutes. Garmin weights vigorous at 2× toward the 150-min weekly goal. Track daily input to manage your weekly total.',
  source: 'Garmin Venu 4 · HR zone detection',
}
const CALORIES_TREND_INFO: CardInfo = {
  title: 'Total Calories · 7 Days',
  description: 'Total daily calorie burn: resting metabolism plus active calories. Useful for tracking energy trend — not clinical precision.',
  source: 'Garmin Venu 4 · accelerometer',
}


function TrainingOverview() {
  const { data: TRN } = useTrainingData()
  const { isOpen: statusOpen, handleTap: statusTap } = useCardInfoOverlay('trn-status', STATUS_INFO, A)
  const { isOpen: ratioOpen, handleTap: ratioTap } = useCardInfoOverlay('trn-loadratio', LOAD_RATIO_INFO, A)
  const { isOpen: intensityOpen, handleTap: intensityTap } = useCardInfoOverlay('trn-intensity', INTENSITY_INFO, A)
  const { isOpen: zonesOpen, handleTap: zonesTap } = useCardInfoOverlay('trn-hrzones', ZONES_INFO, A)
  const { isOpen: stepsOpen, handleTap: stepsTap } = useCardInfoOverlay('trn-steps', STEPS_INFO, A)

  const totalZoneMins = TRN.hrZones.reduce((s, z) => s + z.mins, 0)
  const ratioColor = TRN.loadRatio?.state === 'Optimal' ? A
    : TRN.loadRatio?.state === 'High' ? COLORS.mx4Red : COLORS.mx4Amber
  const ratioPos = TRN.loadRatio ? Math.max(0, Math.min(1, (TRN.loadRatio.value - 0.5) / 1.0)) : 0

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
        <HeadlineCard accent={A} label="Fitness Age" info={FITNESS_AGE_INFO} compact
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

        <HeadlineCard accent={A} label="Acute Load" info={ACUTE_LOAD_INFO} compact
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

      {/* Load Ratio card with range track */}
      {TRN.loadRatio && (
        <div onClick={ratioTap} style={{ position: 'relative', marginBottom: 9, cursor: 'pointer', overflow: 'hidden', borderRadius: 8 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '11px 13px 12px' }}>
            <Bracket color={A} inset={6} op={0.28} radius={4} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>LOAD RATIO · ACUTE : CHRONIC</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{TRN.loadRatio.value.toFixed(2)}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: ratioColor }}>{TRN.loadRatio.state.toUpperCase()}</span>
              </div>
            </div>
            {/* Range track: 0.5 → 1.5, optimal band 0.8–1.3 */}
            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: hexA(COLORS.textMuted, 0.12), marginBottom: 6 }}>
              <div style={{ position: 'absolute', left: '30%', width: '50%', height: '100%', background: hexA(A, 0.2), borderRadius: 2 }} />
              <div style={{ position: 'absolute', top: -2, left: `calc(${ratioPos * 100}% - 6px)`, width: 12, height: 12, borderRadius: '50%', background: ratioColor, boxShadow: `0 0 6px ${hexA(ratioColor, 0.5)}` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted }}>{TRN.loadRatio.acute} acute · {Math.round(TRN.loadRatio.chronic)} chronic (28d)</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: hexA(COLORS.mx4Green, 0.7) }}>optimal 0.8–1.3</span>
            </div>
          </div>
          {ratioOpen && <InfoOverlay info={LOAD_RATIO_INFO} accent={A} radius={8} onClick={ratioTap} />}
        </div>
      )}

      <Rail label="INTENSITY THIS WEEK" accent={A} right={`GOAL ${TRN.intensity.goal} MIN`} />
      <div onClick={intensityTap} style={{
        position: 'relative', background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 9, padding: '11px 14px 12px', overflow: 'hidden',
        marginBottom: 9, cursor: 'pointer',
      }}>
        <Bracket color={A} inset={6} op={0.28} radius={4} />
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
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: TRN.dailyActivity.steps != null && TRN.dailyActivity.steps >= TRN.dailyActivity.stepsGoal ? COLORS.green : COLORS.textMuted }}>
              {TRN.dailyActivity.steps != null
                ? TRN.dailyActivity.steps >= TRN.dailyActivity.stepsGoal ? 'GOAL MET ◆' : `${(TRN.dailyActivity.stepsGoal - TRN.dailyActivity.steps).toLocaleString()} TO GO`
                : '—'}
            </span>
          </div>
          <Bars7 data={TRN.dailyActivity.stepsTrend} accent={A} h={80}
            fmt={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            goal={TRN.dailyActivity.stepsGoal} />
          {stepsOpen && <InfoOverlay info={STEPS_INFO} accent={A} radius={10} onClick={stepsTap} />}
        </div>
      )}

      {/* Daily tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
        {TRN.dailyActivity.distanceKm != null && (
          <VitalTile label="Distance" value={TRN.dailyActivity.distanceKm} unit="km" accent={A} goal={8}
            info={{ description: 'GPS-tracked distance today across all activities.' }} />
        )}
        {TRN.dailyActivity.caloriesTotal != null && (
          <VitalTile label="Calories" value={TRN.dailyActivity.caloriesTotal} unit="kcal" accent={A} goal={2500}
            info={{ description: 'Resting + active calories. Good for trends.' }} />
        )}
        {TRN.dailyActivity.caloriesActive != null && (
          <VitalTile label="Active Cal" value={TRN.dailyActivity.caloriesActive} unit="kcal" accent={A} goal={600}
            info={{ description: 'Activity-only calories. Reflects workout output.' }} />
        )}
        {TRN.dailyActivity.floors != null && (
          <VitalTile label="Floors" value={Math.round(TRN.dailyActivity.floors)} unit="fl" accent={A} goal={TRN.dailyActivity.floorsGoal}
            info={{ description: 'Barometric altimeter. Vertical gain beyond steps.' }} />
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

type TrendSection = { railLabel: string; period: string; subtext: string; info: CardInfo }

const TREND_SECTIONS: Record<string, TrendSection> = {
  load:       { railLabel: 'TRAINING LOAD',     period: '7 DAYS',  subtext: '', info: LOAD_TREND_INFO },
  volume:     { railLabel: 'WEEKLY VOLUME',     period: '6 WEEKS', subtext: 'most recent week may be partial', info: VOL_INFO },
  fitnessAge: { railLabel: 'FITNESS AGE',       period: '30 DAYS', subtext: 'lower = better · descending = improving aerobic capacity', info: FA_TREND_INFO },
  actHr:      { railLabel: 'AVG ACTIVITY HR',   period: '6 WEEKS', subtext: 'same effort, lower HR = aerobic adaptation', info: ACTHR_INFO },
  vo2max:     { railLabel: 'VO2 MAX',           period: '30 DAYS', subtext: 'higher = better · improves with consistent zone 2–4 training', info: VO2MAX_TREND_INFO },
  intensity:  { railLabel: 'INTENSITY MINUTES', period: '7 DAYS',  subtext: 'vigorous minutes weighted 2× toward the weekly goal', info: INTENSITY_TREND_INFO },
  steps:      { railLabel: 'DAILY STEPS',       period: '7 DAYS',  subtext: '8–10k steps/day linked to reduced all-cause mortality', info: STEPS_INFO },
  calories:   { railLabel: 'TOTAL CALORIES',    period: '7 DAYS',  subtext: 'resting + active calories · useful for tracking energy trend', info: CALORIES_TREND_INFO },
}

const BESPOKE_CARD: CSSProperties = {
  position: 'relative', background: COLORS.surface,
  border: `1px solid ${COLORS.line}`, borderRadius: 10,
  padding: '13px 14px 11px', overflow: 'hidden', cursor: 'pointer',
}

const SUBTEXT: CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, padding: '0 4px',
}

function TrainingTrends() {
  const { data: TRN } = useTrainingData()
  const { isOpen: loadOpen, handleTap: loadTap } = useCardInfoOverlay('trn-load-trend', TREND_SECTIONS.load.info, A)
  const { isOpen: volOpen, handleTap: volTap } = useCardInfoOverlay('trn-volume', TREND_SECTIONS.volume.info, A)
  const { isOpen: faOpen, handleTap: faTap } = useCardInfoOverlay('trn-fitnessage-trend', TREND_SECTIONS.fitnessAge.info, A)
  const { isOpen: vo2Open, handleTap: vo2Tap } = useCardInfoOverlay('trn-vo2max', TREND_SECTIONS.vo2max.info, A)

  const faValue = typeof TRN.vo2max.fitnessAge === 'number' ? TRN.vo2max.fitnessAge.toFixed(1) : TRN.vo2max.fitnessAge
  const loadSubtext = TRN.load.low && TRN.load.high
    ? `optimal band: ${TRN.load.low}–${TRN.load.high} · spikes above raise injury risk`
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>

      {TRN.load.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.load.railLabel} accent={A} right={TREND_SECTIONS.load.period} />
          <div onClick={loadTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>ACUTE LOAD · 7 DAYS</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{TRN.load.value}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: A }}>{TRN.load.state.toUpperCase()}</span>
              </span>
            </div>
            <Bars7 data={TRN.load.trend} accent={A} h={80} avg />
            {loadOpen && <InfoOverlay info={TREND_SECTIONS.load.info} accent={A} radius={10} compact onClick={loadTap} />}
          </div>
          {loadSubtext && <div style={SUBTEXT}>{loadSubtext}</div>}
        </>
      )}

      {TRN.weeklyVolume && TRN.weeklyVolume.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.volume.railLabel} accent={A} right={TREND_SECTIONS.volume.period} />
          <div onClick={volTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 10 }}>HOURS / WEEK</div>
            <Bars7
              data={TRN.weeklyVolume.map(w => w.hours)}
              accent={A} h={70}
              labels={TRN.weeklyVolume.map(w => `W${parseInt(w.week.split('-')[1], 10)}`)}
              fmt={v => v.toFixed(1)}
              avg
            />
            {volOpen && <InfoOverlay info={TREND_SECTIONS.volume.info} accent={A} radius={10} compact onClick={volTap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.volume.subtext}</div>
        </>
      )}

      {TRN.vo2max.fitnessAgeTrend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.fitnessAge.railLabel} accent={A} right={TREND_SECTIONS.fitnessAge.period} />
          <div onClick={faTap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>IMPROVING ↓</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>
                  {TRN.vo2max.fitnessAgeTrend[0].toFixed(1)} →
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700, color: COLORS.green }}>{faValue}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>yr</span>
              </div>
            </div>
            <Sparkline data={TRN.vo2max.fitnessAgeTrend} accent={A} w={350} h={50} sw={1.8} />
            {faOpen && <InfoOverlay info={TREND_SECTIONS.fitnessAge.info} accent={A} radius={10} compact onClick={faTap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.fitnessAge.subtext}</div>
        </>
      )}

      {TRN.activityHrByWeek && TRN.activityHrByWeek.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.actHr.railLabel} accent={A} right={TREND_SECTIONS.actHr.period} />
          <TrendRow
            label="Avg HR"
            value={TRN.activityHrByWeek[TRN.activityHrByWeek.length - 1].avg_hr}
            unit="bpm"
            data={TRN.activityHrByWeek.map(w => w.avg_hr)}
            accent={A}
            delta={TRN.activityHrByWeek[TRN.activityHrByWeek.length - 1].avg_hr - TRN.activityHrByWeek[0].avg_hr}
            lowerBetter kind="bars" avg
            info={TREND_SECTIONS.actHr.info}
          />
          <div style={SUBTEXT}>{TREND_SECTIONS.actHr.subtext}</div>
        </>
      )}

      {TRN.vo2max.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.vo2max.railLabel} accent={A} right={TREND_SECTIONS.vo2max.period} />
          <div onClick={vo2Tap} style={BESPOKE_CARD}>
            <Bracket color={A} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>ML/KG/MIN</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{TRN.vo2max.value}</span>
                {TRN.vo2max.delta !== 0 && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: TRN.vo2max.delta > 0 ? COLORS.green : COLORS.red }}>
                    {TRN.vo2max.delta > 0 ? '+' : ''}{TRN.vo2max.delta.toFixed ? TRN.vo2max.delta.toFixed(1) : TRN.vo2max.delta}
                  </span>
                )}
              </div>
            </div>
            <Sparkline data={TRN.vo2max.trend} accent={A} w={350} h={50} sw={1.8} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>30d ago</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: A, fontWeight: 600 }}>today</span>
            </div>
            {vo2Open && <InfoOverlay info={TREND_SECTIONS.vo2max.info} accent={A} radius={10} compact onClick={vo2Tap} />}
          </div>
          <div style={SUBTEXT}>{TREND_SECTIONS.vo2max.subtext}</div>
        </>
      )}

      {TRN.intensity.trend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.intensity.railLabel} accent={A} right={TREND_SECTIONS.intensity.period} />
          <TrendRow label="Intensity" value={`${TRN.intensity.moderate + TRN.intensity.vigorous * 2}`} unit="pts" data={TRN.intensity.trend} accent={A} kind="bars" avg info={TREND_SECTIONS.intensity.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.intensity.subtext}</div>
        </>
      )}

      {TRN.dailyActivity.stepsTrend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.steps.railLabel} accent={A} right={TREND_SECTIONS.steps.period} />
          <TrendRow
            label="Steps"
            value={TRN.dailyActivity.steps != null ? TRN.dailyActivity.steps.toLocaleString() : 0}
            data={TRN.dailyActivity.stepsTrend}
            accent={A} kind="bars" avg
            fmt={v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)}
            info={TREND_SECTIONS.steps.info}
          />
          <div style={SUBTEXT}>{TREND_SECTIONS.steps.subtext}</div>
        </>
      )}

      {TRN.dailyActivity.calTrend.length > 0 && (
        <>
          <Rail label={TREND_SECTIONS.calories.railLabel} accent={A} right={TREND_SECTIONS.calories.period} />
          <TrendRow label="Calories" value={TRN.dailyActivity.caloriesTotal ?? 0} unit="kcal" data={TRN.dailyActivity.calTrend} accent={A} kind="bars" avg info={TREND_SECTIONS.calories.info} />
          <div style={SUBTEXT}>{TREND_SECTIONS.calories.subtext}</div>
        </>
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
