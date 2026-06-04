/* bacta-v3-recovery.jsx — Recovery channel v3 + InfoCard on every card. */

function RecoveryViewV3({ tab }) {
  const { color } = BACTA;
  const accent = BACTA.section.recovery.accent;
  const m = BACTA.metrics.recovery;

  if (tab === 'trends') {
    return (
      <RecScroll>
        <MX4Briefing channel="recovery" brief={BACTA.brief.recovery} label="RECOVERY" />
        <Rail label="7-DAY READINESS" accent={accent} right="TREND" />
        <InfoCard id="rec-score-trend" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 11 }}
          title="Recovery Score"
          description="Garmin's composite readiness score, synthesizing HRV, Body Battery, resting HR, and sleep quality relative to your personal 7-day baselines. A score above 67 signals your body is prepared for high-intensity training."
          source="Garmin Fenix 7X · nightly compute">
          <div style={{ position: 'relative', background: color.surface,
            border: `1px solid ${color.line}`, borderRadius: 10,
            padding: '13px 14px 11px', overflow: 'hidden' }}>
            <Bracket color={accent} inset={6} op={0.35} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>RECOVERY SCORE</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.score.value}</span>
                <Delta value={m.score.trend[6] - m.score.trend[0]} />
              </span>
            </div>
            <Bars7v2 data={m.score.trend} accent={accent} h={78} />
          </div>
        </InfoCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <TrendRow label="HRV" value={m.hrv.value} unit="ms" data={m.hrv.trend} accent={accent} delta={m.hrv.value - m.hrv.weekAvg} />
          <TrendRow label="HRV 7d avg" value={m.hrv.weekAvg} unit="ms" data={m.hrv.trend.map(() => m.hrv.weekAvg)} accent={accent} />
          <TrendRow label="Body Battery" value={m.battery.wake} unit="at wake" data={m.battery.trend} accent={accent} delta={m.battery.trend[6] - m.battery.trend[0]} kind="bars" />
          <TrendRow label="Resting HR" value={m.rhr.value} unit="bpm" data={m.rhr.trend} accent={accent} delta={m.rhr.value - m.rhr.avg} lowerBetter />
          <TrendRow label="Stress" value={m.stress.avg} unit="avg" data={m.stress.trend} accent={accent} delta={m.stress.trend[6] - m.stress.trend[0]} lowerBetter />
          <TrendRow label="Resp" value={m.resp.avg} unit="br/m" data={m.resp.trend} accent={accent} delta={m.resp.trend[6] - m.resp.trend[0]} lowerBetter />
          <TrendRow label="SpO₂" value={m.spo2.value} unit="%" data={m.spo2.trend} accent={accent} delta={m.spo2.trend[6] - m.spo2.trend[0]} />
        </div>
      </RecScroll>
    );
  }

  const inHRVRange = m.hrv.value >= m.hrv.baselineLow && m.hrv.value <= m.hrv.baselineHigh;
  const hrvDelta   = m.hrv.value - m.hrv.weekAvg;

  return (
    <RecScroll>
      <MX4Briefing channel="recovery" brief={BACTA.brief.recovery} label="RECOVERY" />
      <Rail label="READINESS" accent={accent} right="SYNTHESIZED" />

      {/* Recovery Score hero */}
      <InfoCard id="rec-score" size="hero" noStretch accent={accent} radius={13} style={{ marginBottom: 9 }}
        title="Recovery Score"
        description="Garmin's composite readiness score, synthesizing HRV, Body Battery, resting HR, and sleep quality relative to your personal 7-day baselines. A score above 67 signals your body is prepared for high-intensity training. It weights recent nights more than older ones."
        source="Garmin Fenix 7X · nightly compute">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16,
          background: `linear-gradient(150deg, ${hexA(accent, 0.1)}, ${color.surface} 60%)`,
          border: `1px solid ${hexA(accent, 0.32)}`, borderRadius: 13,
          padding: '15px 16px', overflow: 'hidden' }}>
          <Bracket color={accent} inset={7} op={0.4} />
          <Gauge value={m.score.value} accent={accent} size={108} stroke={7}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.score.value}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.14em', color: color.text3, marginTop: 2 }}>/ 100</span>
          </Gauge>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 9px', borderRadius: 6,
              background: hexA(accent, 0.14), border: `1px solid ${hexA(accent, 0.4)}`, marginBottom: 9 }}>
              <StatusCore accent={accent} size={6} />
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: accent }}>{m.score.state.toUpperCase()}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: color.text2, textWrap: 'pretty' }}>
              Systems restored. Cleared for a <span style={{ color: color.text, fontWeight: 600 }}>high-intensity</span> session today.
            </p>
          </div>
        </div>
      </InfoCard>

      {/* HRV Card */}
      <InfoCard id="rec-hrv" size="chart" noStretch accent={accent} radius={11} style={{ marginBottom: 9 }}
        title="Heart Rate Variability"
        description="HRV measures the millisecond variation between heartbeats. Higher values indicate a more adaptable autonomic nervous system. Your personal baseline (56–75ms) is what matters — not population averages. Above baseline: green light for intensity. Below: prioritize recovery."
        source="Garmin Fenix 7X · overnight RMSSD">
        <div style={{ position: 'relative', background: color.surface,
          border: `1px solid ${color.line}`, borderRadius: 11,
          padding: '13px 14px 12px', overflow: 'hidden' }}>
          <Bracket color={accent} inset={6} op={0.35} radius={4} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.85 }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 3 }}>
            <div>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text2, fontWeight: 600, marginBottom: 5 }}>HRV · LAST NIGHT</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 32, fontWeight: 700, color: color.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{m.hrv.value}</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, color: color.text3 }}>ms</span>
                <Delta value={hrvDelta} unit="ms" size={10} />
              </div>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3, marginTop: 4 }}>vs {m.hrv.weekAvg}ms week avg</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 160 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5,
                background: hexA(inHRVRange ? color.green : color.amber, 0.12),
                border: `1px solid ${hexA(inHRVRange ? color.green : color.amber, 0.42)}` }}>
                <StatusCore accent={inHRVRange ? color.green : color.amber} size={5} />
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: inHRVRange ? color.green : color.amber }}>{inHRVRange ? 'IN RANGE' : 'BELOW'}</span>
              </div>
              {m.hrvDirection && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5,
                  background: hexA(color.green, 0.11), border: `1px solid ${hexA(color.green, 0.38)}` }}>
                  <StatusCore accent={color.green} size={5} />
                  <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: color.green }}>{m.hrvDirection.label}</span>
                </div>
              )}
            </div>
          </div>
          <HRVBandChart data={m.hrv.trend} baselineLow={m.hrv.baselineLow} baselineHigh={m.hrv.baselineHigh} weekAvg={m.hrv.weekAvg} accent={accent} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, paddingLeft: 2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 14, height: 7, background: hexA(accent, 0.13), border: `1px dashed ${hexA(accent, 0.42)}`, borderRadius: 1 }} />
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>baseline {m.hrv.baselineLow}–{m.hrv.baselineHigh}ms</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 14, borderTop: `1px dashed ${hexA(color.text2, 0.35)}` }} />
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>7d avg {m.hrv.weekAvg}ms</span>
            </span>
          </div>
        </div>
      </InfoCard>

      {/* Body Battery */}
      {m.bodyBatteryIntraday && (
        <InfoCard id="rec-battery" size="chart" noStretch accent={accent} radius={11} style={{ marginBottom: 9 }}
          title="Body Battery"
          description="Garmin's proprietary energy reserve model, computed from HRV, stress, and activity throughout the day. Charges during deep, low-stress sleep; depletes with physical and mental exertion. The curve shows how your reserve moved from last night through this morning."
          source="Garmin Fenix 7X · continuous HRV + stress">
          <div style={{ position: 'relative', background: color.surface,
            border: `1px solid ${color.line}`, borderRadius: 11,
            padding: '13px 14px 11px', overflow: 'hidden' }}>
            <Bracket color={accent} inset={6} op={0.28} />
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.7 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, paddingLeft: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>BODY BATTERY · TODAY</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.battery.current}</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>now</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.amber }}>−{m.battery.consumed}</span>
              </div>
            </div>
            <BodyBatteryArc data={m.bodyBatteryIntraday} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, paddingLeft: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: hexA(BACTA.section.training.accent, 0.2), border: `1.5px solid ${BACTA.section.training.accent}` }} />
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>run event</span>
              </span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>wake {m.battery.wake}% → current {m.battery.current}%</span>
            </div>
          </div>
        </InfoCard>
      )}

      {/* Resting HR + Stress */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <InfoCard id="rec-rhr" size="pair" accent={accent} radius={10} style={{ flex: 1 }} compact
          title="Resting Heart Rate"
          description="Measured during your deepest sleep, resting HR is your heart's baseline efficiency. A downward trend over weeks is a reliable signal of growing cardiovascular fitness — same cardiac output, fewer beats."
          source="Garmin Fenix 7X · sleep detection">
          <HeadlineCard accent={accent} label="Resting HR"
            foot={<Delta value={m.rhr.value - m.rhr.avg} unit=" bpm" lowerBetter size={9.5} />}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.rhr.value}</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text3 }}>bpm</span>
            </div>
            <Sparkline data={m.rhr.trend} accent={accent} w={150} h={20} sw={1.5} />
          </HeadlineCard>
        </InfoCard>
        <InfoCard id="rec-stress" size="pair" accent={accent} radius={10} style={{ flex: 1 }} compact
          title="Stress Score"
          description="Derived from HRV patterns throughout the day. 0–25 is rest, 26–50 low, 51–75 medium, 76–100 high. A consistently low overnight average is one of the strongest recovery signals in the dataset."
          source="Garmin Fenix 7X · HRV-derived">
          <HeadlineCard accent={accent} label="Stress"
            foot={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Delta value={m.stress.avg - m.stress.trend[0]} unit="" lowerBetter size={9.5} />
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.green }}>{m.stress.label}</span>
              </div>
            }>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.stress.avg}</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text3 }}>avg</span>
            </div>
            <Sparkline data={m.stress.trend} accent={accent} w={150} h={20} sw={1.5} />
          </HeadlineCard>
        </InfoCard>
      </div>

      {/* Overnight Vitals */}
      <Rail label="OVERNIGHT VITALS" accent={accent} right="HEALTH STATUS" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <InfoCard id="rec-stress-avg" size="tile" accent={accent} radius={9} compact
          title="Overnight Stress"
          description="HRV-derived stress during sleep. Below 26 is Rest — your nervous system staying calm directly supports HRV recovery and next-day readiness."
          source="Garmin Fenix 7X">
          <HealthStatusTile label="Stress avg" value={m.stress.avg} unit="avg" data={m.stress.trend} inRange={true} accent={accent} sub="LOW · well below 26" lowerBetter />
        </InfoCard>
        <InfoCard id="rec-peak-stress" size="tile" accent={accent} radius={9} compact
          title="Peak Stress"
          description="Highest single stress reading in 24h. Exercise peaks are normal. Peaks above 60 during sleep fragment recovery and suppress next-morning HRV."
          source="Garmin Fenix 7X">
          <HealthStatusTile label="Peak Stress" value={m.stress.max} unit="max" data={m.stress.maxTrend || []} inRange={m.stress.max < 60} accent={accent} sub={m.stress.max >= 60 ? 'elevated peak' : 'within range'} lowerBetter />
        </InfoCard>
        <InfoCard id="rec-resp" size="tile" accent={accent} radius={9} compact
          title="Respiration Rate"
          description="Breaths per minute at rest. Normal 12–20 bpm. A rise of 1–2 breaths above your baseline often signals illness before other symptoms appear."
          source="Garmin Fenix 7X">
          <HealthStatusTile label="Respiration" value={m.resp.avg} unit="br/m" data={m.resp.trend} inRange={true} accent={accent} sub="12–20 normal" lowerBetter />
        </InfoCard>
        <InfoCard id="rec-spo2" size="tile" accent={accent} radius={9} compact
          title="Blood Oxygen (SpO₂)"
          description="Percentage of hemoglobin carrying oxygen. Above 95% normal, 97%+ excellent. Drops below 90% during sleep may indicate sleep-disordered breathing."
          source="Garmin Fenix 7X">
          <HealthStatusTile label="SpO₂" value={m.spo2.value} unit="%" data={m.spo2.trend} inRange={m.spo2.value >= 95} accent={accent} sub={m.spo2.value >= 97 ? 'excellent' : 'normal'} />
        </InfoCard>
      </div>
    </RecScroll>
  );
}

Object.assign(window, { RecoveryView: RecoveryViewV3 });
