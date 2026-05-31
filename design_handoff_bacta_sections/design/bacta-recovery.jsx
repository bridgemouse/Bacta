/* bacta-recovery.jsx — Recovery channel (Overview + Trends).
   Headliners: HRV + Body Battery. Recovery Score is the synthesizing number. */

function RecScroll({ children }) {
  return <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overscrollBehavior: 'none', padding: '13px 13px 20px' }}>{children}</div>;
}

function HeadlineCard({ accent, label, children, foot }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', flex: 1, background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '12px 13px 11px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Bracket color={accent} inset={6} op={0.4} radius={4} />
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.85 }} />
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text2, fontWeight: 600, marginBottom: 8, paddingLeft: 3 }}>{label}</div>
      {children}
      {foot && <div style={{ marginTop: 'auto', paddingTop: 8 }}>{foot}</div>}
    </div>
  );
}

function RecoveryView({ tab }) {
  const { color } = BACTA;
  const accent = BACTA.section.recovery.accent;
  const m = BACTA.metrics.recovery;

  if (tab === 'trends') {
    return (
      <RecScroll>
        <MX4Briefing channel="recovery" brief={BACTA.brief.recovery} label="RECOVERY" />
        <Rail label="7-DAY READINESS" accent={accent} right="MON BASELINE" />
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden', marginBottom: 11 }}>
          <Bracket color={accent} inset={6} op={0.35} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>RECOVERY SCORE</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.score.value}</span>
              <Delta value={m.score.trend[6] - m.score.trend[0]} />
            </span>
          </div>
          <Bars7 data={m.score.trend} accent={accent} h={78} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <TrendRow label="HRV" value={m.hrv.value} unit="ms" data={m.hrv.trend} accent={accent} delta={m.hrv.trend[6] - m.hrv.trend[0]} />
          <TrendRow label="Body Batt" value={m.battery.max} unit="peak" data={m.battery.trend} accent={accent} delta={m.battery.trend[6] - m.battery.trend[0]} />
          <TrendRow label="Rest HR" value={m.rhr.value} unit="bpm" data={m.rhr.trend} accent={accent} delta={m.rhr.trend[6] - m.rhr.trend[0]} lowerBetter />
          <TrendRow label="Stress" value={m.stress.value} unit="avg" data={m.stress.trend} accent={accent} delta={m.stress.trend[6] - m.stress.trend[0]} lowerBetter />
          <TrendRow label="SpO2" value={m.spo2.value} unit="%" data={m.spo2.trend} accent={accent} delta={m.spo2.trend[6] - m.spo2.trend[0]} />
          <TrendRow label="Resp" value={m.resp.value} unit="br" data={m.resp.trend} accent={accent} delta={m.resp.trend[6] - m.resp.trend[0]} lowerBetter />
        </div>
      </RecScroll>
    );
  }

  /* ── OVERVIEW ── */
  return (
    <RecScroll>
      <MX4Briefing channel="recovery" brief={BACTA.brief.recovery} label="RECOVERY" />
      <Rail label="READINESS" accent={accent} right="SYNTHESIZED" />

      {/* Synthesizing hero — Recovery Score gauge */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, background: `linear-gradient(150deg, ${hexA(accent, 0.1)}, ${color.surface} 60%)`, border: `1px solid ${hexA(accent, 0.32)}`, borderRadius: 13, padding: '15px 16px', overflow: 'hidden', marginBottom: 11 }}>
        <Bracket color={accent} inset={7} op={0.4} />
        <Gauge value={m.score.value} accent={accent} size={108} stroke={7}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.score.value}</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.14em', color: color.text3, marginTop: 2 }}>/ 100</span>
        </Gauge>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 6, background: hexA(accent, 0.14), border: `1px solid ${hexA(accent, 0.4)}`, marginBottom: 9 }}>
            <StatusCore accent={accent} size={6} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: accent }}>{m.score.state.toUpperCase()}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: color.text2, textWrap: 'pretty' }}>
            Systems are restored. Cleared for a <span style={{ color: color.text, fontWeight: 600 }}>high-intensity</span> session today.
          </p>
        </div>
      </div>

      {/* Headliners */}
      <div style={{ display: 'flex', gap: 9 }}>
        <HeadlineCard accent={accent} label="HRV · last night"
          foot={<Sparkline data={m.hrv.trend} accent={accent} w={150} h={26} sw={1.7} />}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.hrv.value}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, color: color.text3 }}>{m.hrv.unit}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, paddingLeft: 3 }}>
            <Delta value={m.hrv.value - m.hrv.avg} unit="ms" size={10} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>vs {m.hrv.avg} avg</span>
          </div>
        </HeadlineCard>

        <HeadlineCard accent={accent} label="Body Battery"
          foot={<BodyBattery now={m.battery.now} max={m.battery.max} min={m.battery.min} accent={accent} />}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.battery.now}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, color: color.text3 }}>now</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 7, paddingLeft: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>PEAK <span style={{ color: accent, fontWeight: 600 }}>{m.battery.max}</span></span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>LOW <span style={{ color: color.text2, fontWeight: 600 }}>{m.battery.min}</span></span>
          </div>
        </HeadlineCard>
      </div>

      <Rail label="VITALS" accent={accent} right="LAST NIGHT" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <VitalTile label="Rest HR" value={m.rhr.value} unit={m.rhr.unit} data={m.rhr.trend} accent={accent} delta={m.rhr.value - m.rhr.avg} lowerBetter />
        <VitalTile label="Stress" value={m.stress.value} unit={m.stress.unit} data={m.stress.trend} accent={accent} delta={m.stress.value - m.stress.avg} lowerBetter />
        <VitalTile label="SpO2" value={m.spo2.value} unit={m.spo2.unit} data={m.spo2.trend} accent={accent} delta={m.spo2.value - m.spo2.avg} />
        <VitalTile label="Respiration" value={m.resp.value} unit={m.resp.unit} data={m.resp.trend} accent={accent} delta={m.resp.value - m.resp.avg} lowerBetter />
      </div>
    </RecScroll>
  );
}

Object.assign(window, { RecoveryView, RecScroll, HeadlineCard });
