import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../theme'
import { BRIEFS, fmtDur } from '../lib/stubData'
import { useSleepData } from '../hooks/useSleepData'
import { Gauge } from '../components/viz/Gauge'
import { HeadlineCard } from '../components/viz/HeadlineCard'
import { Rail } from '../components/viz/Rail'
import { VitalTile } from '../components/viz/VitalTile'
import { TrendRow } from '../components/viz/TrendRow'
import { SleepDepth } from '../components/viz/SleepDepth'
import { StageSplit } from '../components/viz/StageSplit'
import { StageLegend } from '../components/viz/StageLegend'

const A = SECTION_ACCENTS.sleep

function SleepOverview() {
  const { data: slp } = useSleepData()
  const efficiencyPct = slp.duration.inBed > 0
    ? Math.round((slp.duration.mins / slp.duration.inBed) * 100)
    : 0
  const debtH = slp.sleepDebt != null ? Math.floor(slp.sleepDebt / 60) : 0
  const debtM = slp.sleepDebt != null ? slp.sleepDebt % 60 : 0

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.sleep} />

      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard
          accent={A}
          label="Duration"
          foot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
                {efficiencyPct}% efficiency
              </span>
              {slp.sleepDebt != null && slp.sleepDebt > 0 && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.mx4Amber }}>
                  DEBT {debtH > 0 ? `${debtH}h ` : ''}{String(debtM).padStart(2, '0')}m
                </span>
              )}
            </div>
          }
        >
          <Gauge value={slp.duration.mins} max={480} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {slp.duration.h}h {String(slp.duration.m).padStart(2, '0')}m
            </span>
          </Gauge>
        </HeadlineCard>

        <HeadlineCard
          accent={A}
          label="Sleep Score"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary }}>
              {slp.score.state}
            </span>
          }
        >
          <Gauge value={slp.score.value} max={100} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {slp.score.value}
            </span>
          </Gauge>
        </HeadlineCard>
      </div>

      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px', marginBottom: 9,
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 8 }}>
          OVERNIGHT DEPTH
        </div>
        <SleepDepth hypno={slp.hypno} accent={A} h={80} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>23:00</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>03:00</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>07:00</span>
        </div>
      </div>

      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px', marginBottom: 9,
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 10 }}>
          STAGE BREAKDOWN · {fmtDur(slp.duration.mins)}
          {slp.deepRatio != null && ` · DEEP ${slp.deepRatio}%`}
          {slp.remRatio  != null && ` · REM ${slp.remRatio}%`}
        </div>
        <StageSplit stages={slp.stages} />
        <div style={{ marginTop: 10 }}>
          <StageLegend stages={slp.stages} />
        </div>
      </div>

      <Rail label="OVERNIGHT VITALS" accent={A} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {slp.spo2.avg != null && (
          <VitalTile label="SpO₂ avg" value={slp.spo2.avg} unit="%" accent={A} />
        )}
        {slp.spo2.low != null && (
          <VitalTile label="SpO₂ low" value={slp.spo2.low} unit="%" accent={A} />
        )}
        <VitalTile label="Respiration" value={slp.resp.avg} unit="br/m" accent={A} />
        {slp.sleepHr != null && (
          <VitalTile label="Avg Heart Rate" value={slp.sleepHr} unit="bpm" data={slp.sleepHrTrend} accent={A} />
        )}
        {slp.sleepStress != null && (
          <VitalTile label="Sleep Stress" value={slp.sleepStress} unit="" data={slp.sleepStressTrend} accent={A} lowerBetter />
        )}
      </div>
    </>
  )
}

function SleepTrends() {
  const { data: slp } = useSleepData()
  const fmtH = (mins: number) => `${(mins / 60).toFixed(1)}h`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {slp.duration.trend.length > 0 && (
        <TrendRow label="Duration" value={`${slp.duration.h}h ${String(slp.duration.m).padStart(2, '0')}m`} data={slp.duration.trend} accent={A} kind="bars" fmt={fmtH} />
      )}
      {slp.score.trend.length > 0 && (
        <TrendRow label="Score" value={slp.score.value} data={slp.score.trend} accent={A} />
      )}
      {slp.sleepRespTrend.length > 0 && (
        <TrendRow label="Respiration" value={slp.resp.avg} unit="br/m" data={slp.sleepRespTrend} accent={A} lowerBetter />
      )}
      {slp.sleepHrTrend.length > 0 && slp.sleepHr != null && (
        <TrendRow label="Heart Rate" value={slp.sleepHr} unit="bpm" data={slp.sleepHrTrend} accent={A} lowerBetter />
      )}
      {slp.sleepStressTrend.length > 0 && slp.sleepStress != null && (
        <TrendRow label="Stress" value={slp.sleepStress} unit="avg" data={slp.sleepStressTrend} accent={A} lowerBetter />
      )}
    </div>
  )
}

function SleepContent() {
  const tab = useTab()
  return tab === 'overview' ? <SleepOverview /> : <SleepTrends />
}

export function SleepPage() {
  return (
    <AppShell section="sleep" hasTabs>
      <SleepContent />
    </AppShell>
  )
}
