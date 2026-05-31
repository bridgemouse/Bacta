import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../theme'
import { BRIEFS, SLEEP, fmtDur } from '../lib/stubData'
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
  const efficiencyPct = Math.round((SLEEP.duration.mins / SLEEP.duration.inBed) * 100)

  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.sleep} />

      {/* Headline row: Duration + Score */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard
          accent={A}
          label="Duration"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
              {efficiencyPct}% efficiency
            </span>
          }
        >
          <Gauge value={SLEEP.duration.mins} max={480} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {SLEEP.duration.h}h {String(SLEEP.duration.m).padStart(2, '0')}m
            </span>
          </Gauge>
        </HeadlineCard>

        <HeadlineCard
          accent={A}
          label="Sleep Score"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary }}>
              {SLEEP.score.state}
            </span>
          }
        >
          <Gauge value={SLEEP.score.value} max={100} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {SLEEP.score.value}
            </span>
          </Gauge>
        </HeadlineCard>
      </div>

      {/* Sleep depth chart */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px', marginBottom: 9,
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 8 }}>
          OVERNIGHT DEPTH
        </div>
        <SleepDepth hypno={SLEEP.hypno} accent={A} h={80} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>23:00</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>03:00</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>07:00</span>
        </div>
      </div>

      {/* Stage breakdown */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px', marginBottom: 9,
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600, marginBottom: 10 }}>
          STAGE BREAKDOWN · {fmtDur(SLEEP.duration.mins)}
        </div>
        <StageSplit stages={SLEEP.stages} />
        <div style={{ marginTop: 10 }}>
          <StageLegend stages={SLEEP.stages} />
        </div>
      </div>

      <Rail label="OVERNIGHT VITALS" accent={A} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <VitalTile label="SpO₂ avg" value={SLEEP.spo2.avg} unit="%" accent={A} />
        <VitalTile label="SpO₂ low" value={SLEEP.spo2.low} unit="%" accent={A} />
        <VitalTile label="Respiration" value={SLEEP.resp.avg} unit="br/m" accent={A} />
      </div>
    </>
  )
}

function SleepTrends() {
  const fmtH = (mins: number) => `${(mins / 60).toFixed(1)}h`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <TrendRow
        label="Duration"
        value={`${SLEEP.duration.h}h ${String(SLEEP.duration.m).padStart(2, '0')}m`}
        data={SLEEP.duration.trend} accent={A} kind="bars" fmt={fmtH}
      />
      <TrendRow
        label="Score" value={SLEEP.score.value}
        data={SLEEP.score.trend} accent={A}
      />
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
