import { AppShell } from '../components/AppShell'
import { MX4Briefing } from '../components/MX4Card'
import { useTab } from '../lib/TabContext'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../theme'
import { BRIEFS, RECOVERY } from '../lib/stubData'
import { Gauge } from '../components/viz/Gauge'
import { HeadlineCard } from '../components/viz/HeadlineCard'
import { BodyBattery } from '../components/viz/BodyBattery'
import { Rail } from '../components/viz/Rail'
import { VitalTile } from '../components/viz/VitalTile'
import { TrendRow } from '../components/viz/TrendRow'

const A = SECTION_ACCENTS.recovery

function RecoveryOverview() {
  return (
    <>
      <MX4Briefing accent={A} brief={BRIEFS.recovery} />

      {/* Headline row: Score + HRV */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <HeadlineCard
          accent={A}
          label="Recovery Score"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textSecondary }}>
              {RECOVERY.score.state}
            </span>
          }
        >
          <Gauge value={RECOVERY.score.value} max={100} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {RECOVERY.score.value}
            </span>
          </Gauge>
        </HeadlineCard>

        <HeadlineCard
          accent={A}
          label="HRV"
          foot={
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
              avg {RECOVERY.hrv.avg}ms
            </span>
          }
        >
          <Gauge value={RECOVERY.hrv.value} max={100} accent={A} size={100}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
              {RECOVERY.hrv.value}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>ms</span>
          </Gauge>
        </HeadlineCard>
      </div>

      {/* Body Battery card */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`,
        borderRadius: 10, padding: '12px 13px', marginBottom: 9,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em', color: COLORS.textSecondary, fontWeight: 600 }}>
            BODY BATTERY
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
            peak {RECOVERY.battery.max} · low {RECOVERY.battery.min}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
            {RECOVERY.battery.now}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
            recharged +{RECOVERY.battery.now - RECOVERY.battery.min}
          </span>
        </div>
        <BodyBattery
          now={RECOVERY.battery.now}
          max={RECOVERY.battery.max}
          min={RECOVERY.battery.min}
          accent={A}
          height={14}
        />
      </div>

      <Rail label="VITALS" accent={A} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <VitalTile
          label="Resting HR" value={RECOVERY.rhr.value} unit="bpm"
          data={RECOVERY.rhr.trend} accent={A}
          delta={RECOVERY.rhr.value - RECOVERY.rhr.avg} lowerBetter
        />
        <VitalTile
          label="Stress" value={RECOVERY.stress.value} unit="avg"
          data={RECOVERY.stress.trend} accent={A}
          delta={RECOVERY.stress.value - RECOVERY.stress.avg} lowerBetter
        />
        <VitalTile
          label="SpO₂" value={RECOVERY.spo2.value} unit="%"
          data={RECOVERY.spo2.trend} accent={A}
          delta={RECOVERY.spo2.value - RECOVERY.spo2.avg}
        />
        <VitalTile
          label="Respiration" value={RECOVERY.resp.value} unit="br/m"
          data={RECOVERY.resp.trend} accent={A}
          delta={RECOVERY.resp.value - RECOVERY.resp.avg} lowerBetter
        />
      </div>
    </>
  )
}

function RecoveryTrends() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <TrendRow
        label="Score" value={RECOVERY.score.value}
        data={RECOVERY.score.trend} accent={A}
      />
      <TrendRow
        label="HRV" value={RECOVERY.hrv.value} unit="ms"
        data={RECOVERY.hrv.trend} accent={A}
        delta={RECOVERY.hrv.value - RECOVERY.hrv.avg}
      />
      <TrendRow
        label="Body Battery" value={RECOVERY.battery.now}
        data={RECOVERY.battery.trend} accent={A} kind="bars"
      />
      <TrendRow
        label="Resting HR" value={RECOVERY.rhr.value} unit="bpm"
        data={RECOVERY.rhr.trend} accent={A}
        delta={RECOVERY.rhr.value - RECOVERY.rhr.avg} lowerBetter
      />
      <TrendRow
        label="Stress" value={RECOVERY.stress.value} unit="avg"
        data={RECOVERY.stress.trend} accent={A}
        delta={RECOVERY.stress.value - RECOVERY.stress.avg} lowerBetter
      />
      <TrendRow
        label="SpO₂" value={RECOVERY.spo2.value} unit="%"
        data={RECOVERY.spo2.trend} accent={A}
      />
      <TrendRow
        label="Respiration" value={RECOVERY.resp.value} unit="br/m"
        data={RECOVERY.resp.trend} accent={A} lowerBetter
      />
    </div>
  )
}

function RecoveryContent() {
  const tab = useTab()
  return tab === 'overview' ? <RecoveryOverview /> : <RecoveryTrends />
}

export function RecoveryPage() {
  return (
    <AppShell section="recovery" hasTabs>
      <RecoveryContent />
    </AppShell>
  )
}
