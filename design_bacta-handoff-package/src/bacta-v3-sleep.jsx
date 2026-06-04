/* bacta-v3-sleep.jsx — Sleep channel v3 + InfoCard on every card. */

function SleepViewV3({ tab }) {
  const { color } = BACTA;
  const accent = BACTA.section.sleep.accent;
  const m = BACTA.metrics.sleep;
  const totalMins = m.stages.reduce((s, st) => s + st.mins, 0);
  const effPct = m.duration.inBedMins > 0 ? Math.round((m.duration.mins / m.duration.inBedMins) * 100) : 0;
  const awakeInBed = m.duration.inBedMins - m.duration.mins;

  if (tab === 'trends') {
    const avgDur = Math.round(m.duration.trend.reduce((a, b) => a + b, 0) / 7);
    const fmtH = v => (v / 60).toFixed(1);
    return (
      <RecScroll>
        <MX4Briefing channel="sleep" brief={BACTA.brief.sleep} label="SLEEP" />
        <Rail label="7-NIGHT DURATION" accent={accent} right={`AVG ${(avgDur/60).toFixed(1)}H`} />
        <InfoCard id="slp-dur-trend" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 11 }}
          title="Sleep Duration"
          description="Total time actually asleep (not time in bed) across the past 7 nights. The dashed goal line represents 8 hours. Consistent duration is as important as the average — look for nights that fall short and correlate them with next-day recovery scores."
          source="Garmin Fenix 7X · sleep detection">
          <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden' }}>
            <Bracket color={accent} inset={6} op={0.35} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>HOURS ASLEEP</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.duration.h}h {String(m.duration.m).padStart(2,'0')}m</span>
            </div>
            <Bars7v2 data={m.duration.trend} accent={accent} h={80} fmt={fmtH} goal={480} />
          </div>
        </InfoCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <TrendRow label="Score" value={m.score.value} sub={m.score.state} data={m.score.trend} accent={accent} delta={m.score.trend[6] - m.score.trend[0]} kind="bars" />
          <TrendRow label="Duration" value={`${m.duration.h}h ${String(m.duration.m).padStart(2,'0')}m`} data={m.duration.trend} accent={accent} delta={m.duration.trend[6] - m.duration.trend[0]} fmt={fmtH} />
          {m.vitals.hr.trend.length > 0 && <TrendRow label="Sleep HR" value={m.vitals.hr.value} unit="bpm" data={m.vitals.hr.trend} accent={accent} delta={m.vitals.hr.trend[6] - m.vitals.hr.trend[0]} lowerBetter />}
          {m.vitals.resp.trend.length > 0 && <TrendRow label="Resp" value={m.vitals.resp.value} unit="br/m" data={m.vitals.resp.trend} accent={accent} delta={m.vitals.resp.trend[6] - m.vitals.resp.trend[0]} lowerBetter />}
          {m.vitals.stress.trend.length > 0 && <TrendRow label="Stress" value={m.vitals.stress.value} data={m.vitals.stress.trend} accent={accent} delta={m.vitals.stress.trend[6] - m.vitals.stress.trend[0]} lowerBetter />}
        </div>
      </RecScroll>
    );
  }

  return (
    <RecScroll>
      <MX4Briefing channel="sleep" brief={BACTA.brief.sleep} label="SLEEP" />
      <Rail label="LAST NIGHT" accent={accent} right={`${m.bedtime || '22:30'} — ${m.wakeTime || '06:23'}`} />

      {/* Hero */}
      <InfoCard id="slp-hero" size="hero" noStretch accent={accent} radius={13} style={{ marginBottom: 9 }}
        title="Sleep Score & Duration"
        description="Your Sleep Score (0–100) is Garmin's composite of duration, stage quality, and recovery value. Deep sleep and REM are weighted heavily. Fragmentation and early waking reduce it. Duration shown is time actually asleep — not time in bed."
        source="Garmin Fenix 7X · accelerometer + HRV">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
          background: `linear-gradient(150deg, ${hexA(accent, 0.1)}, ${color.surface} 60%)`,
          border: `1px solid ${hexA(accent, 0.32)}`, borderRadius: 13,
          padding: '15px 16px', overflow: 'hidden' }}>
          <Bracket color={accent} inset={7} op={0.4} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.14em', color: color.text3, marginBottom: 6 }}>TIME ASLEEP</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 38, fontWeight: 700, color: color.text, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{m.duration.h}</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 15, color: color.text3, marginRight: 4 }}>h</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 38, fontWeight: 700, color: color.text, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{String(m.duration.m).padStart(2, '0')}</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 15, color: color.text3 }}>m</span>
            </div>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: color.text3, marginTop: 8 }}>{BACTA.fmtDur(m.duration.inBedMins)} in bed</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.green, fontWeight: 600 }}>{effPct}% efficient</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{awakeInBed}m awake</span>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
              {m.stages.filter(s => s.key !== 'awake').map(s => (
                <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, background: hexA(s.color, 0.13), border: `1px solid ${hexA(s.color, 0.32)}` }}>
                  <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7, letterSpacing: '0.06em', color: s.color, fontWeight: 700 }}>{s.label.toUpperCase()}</span>
                  <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, fontWeight: 700, color: color.text }}>{s.mins}m</span>
                </span>
              ))}
            </div>
          </div>
          <Gauge value={m.score.value} accent={accent} size={98} stroke={6}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 26, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.score.value}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, letterSpacing: '0.12em', color: accent, marginTop: 2 }}>{m.score.state.toUpperCase()}</span>
          </Gauge>
        </div>
      </InfoCard>

      {/* Efficiency + Sleep Debt — equal height, individual InfoCards */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 9, alignItems: 'stretch' }}>
        <InfoCard id="slp-efficiency" size="pair" accent={accent} radius={9} style={{ flex: 1 }} compact
          title="Sleep Efficiency"
          description="Time asleep ÷ time in bed. Above 85% is healthy; below 80% suggests fragmentation or difficulty falling asleep."
          source="Garmin Fenix 7X">
          <div style={{ height: '100%', position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderLeft: `3px solid ${accent}`, borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.text2, fontWeight: 600, marginBottom: 5 }}>Efficiency</div>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 22, fontWeight: 700, color: color.text, lineHeight: 1, marginBottom: 5 }}>{effPct}%</div>
            <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${effPct}%`, height: '100%', background: accent, borderRadius: 2 }} />
            </div>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>{awakeInBed}m awake in bed</div>
          </div>
        </InfoCard>
        <InfoCard id="slp-debt" size="pair" accent={accent} radius={9} style={{ flex: 1 }} compact
          title="Sleep Debt"
          description="Shortfall vs your 8h target. Short-term debt is partially recoverable; chronic debt compounds across cognition, metabolism, and immune function."
          source="Bacta-computed">
          <div style={{ height: '100%', position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderLeft: `3px solid ${accent}`, borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.text2, fontWeight: 600, marginBottom: 5 }}>Sleep Debt</div>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 22, fontWeight: 700, color: color.text, lineHeight: 1, marginBottom: 5 }}>{m.duration.debt === 0 ? '0 min' : BACTA.fmtDur(m.duration.debt)}</div>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: m.duration.debt === 0 ? color.green : color.amber, fontWeight: 700, letterSpacing: '0.06em' }}>
              {m.duration.debt === 0 ? 'FULLY RESTORED' : 'BELOW 8H GOAL'}
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Architecture */}
      <InfoCard id="slp-arch" size="chart" noStretch accent={accent} radius={12} style={{ marginBottom: 9 }}
        title="Sleep Architecture"
        description="How your sleep cycles distribute across four stages: Awake, Light (N1/N2), Deep (N3/Slow-Wave), and REM. Ideal adult ratios: ~5% awake, ~50% light, ~20% deep, ~25% REM. The Architecture Score is Bacta-computed from how close your night matches these clinical ideals."
        source="Garmin Fenix 7X · accelerometer + HRV">
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 12, padding: '13px 14px 13px', overflow: 'hidden' }}>
          <Bracket color={accent} inset={6} op={0.32} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.7 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>Sleep Architecture</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>{BACTA.fmtDur(totalMins)} cycled</span>
              {m.architectureScore != null && <SleepArchBadge score={m.architectureScore} />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
            <div style={{ position: 'relative', width: 26, flexShrink: 0, alignSelf: 'stretch' }}>
              {[{ label: 'AW', pct: 7.5 }, { label: 'REM', pct: 36.7 }, { label: 'LT', pct: 65.8 }, { label: 'DP', pct: 95 }].map(({ label, pct }) => (
                <span key={label} style={{ position: 'absolute', right: 0, top: `${pct}%`, transform: 'translateY(-50%)', fontFamily: BACTA.FONT_MONO, fontSize: 6.5, color: hexA(color.text3, 0.65), lineHeight: 1 }}>{label}</span>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <SleepDepth hypno={m.hypno} accent={accent} h={80} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, marginBottom: 12, paddingLeft: 31 }}>
            {[m.bedtime || '22:30', '00:30', '02:30', '04:30', m.wakeTime || '06:23'].map(t => (
              <span key={t} style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>{t}</span>
            ))}
          </div>
          <StageSplitV3 stages={m.stages} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            {m.stages.map(st => <StageCard key={st.key} stage={st} totalMins={totalMins} />)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <span style={{ display: 'inline-block', width: 10, height: 4, background: hexA(accent, 0.25), borderRadius: 1 }} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>shaded = ideal range · ◆ in range · ◈ watch</span>
          </div>
        </div>
      </InfoCard>

      {/* Consistency */}
      {m.consistency && (
        <InfoCard id="slp-consistency" size="chart" noStretch accent={accent} radius={10} style={{ marginBottom: 9 }}
          title="Sleep Consistency"
          description="How stable your bedtime is night to night. Your circadian rhythm depends on predictable timing to regulate melatonin and cortisol. High variability — even at adequate total duration — disrupts sleep quality and next-day alertness."
          source="Bacta-computed · from Garmin sleep timestamps">
          <SleepConsistencyCard data={m.consistency} accent={accent} />
        </InfoCard>
      )}

      {/* Overnight Vitals */}
      <Rail label="OVERNIGHT VITALS" accent={accent} right="WHILE ASLEEP" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <InfoCard id="slp-hr" size="tile" accent={accent} radius={9} compact
          title="Sleeping Heart Rate"
          description="Average HR while asleep. Lower signals better cardiovascular efficiency. Elevation above your norm often precedes illness or flags alcohol's recovery cost."
          source="Garmin Fenix 7X">
          <HealthStatusTile label="Heart Rate" value={m.vitals.hr.value} unit="bpm" data={m.vitals.hr.trend} inRange={true} accent={accent} sub="avg overnight" lowerBetter />
        </InfoCard>
        <InfoCard id="slp-resp" size="tile" accent={accent} radius={9} compact
          title="Respiratory Rate"
          description="Breaths per minute at rest. Normal is 12–20 bpm. A rise of even 1–2 breaths above your baseline often precedes illness by 12–24 hours."
          source="Garmin Fenix 7X">
          <HealthStatusTile label="Respiration" value={m.vitals.resp.value} unit="br/m" data={m.vitals.resp.trend} inRange={true} accent={accent} sub="12–20 normal" lowerBetter />
        </InfoCard>
        <InfoCard id="slp-stress" size="tile" accent={accent} radius={9} compact
          title="Overnight Stress"
          description="HRV-derived stress while asleep. Below 25 is the Rest zone. Elevated overnight stress correlates directly with next-morning HRV suppression."
          source="Garmin Fenix 7X">
          <HealthStatusTile label="Sleep Stress" value={m.vitals.stress.value} unit="avg" data={m.vitals.stress.trend} inRange={true} accent={accent} sub="LOW · restful" lowerBetter />
        </InfoCard>
        {m.vitals.spo2.avg != null && (
          <InfoCard id="slp-spo2" size="tile" accent={accent} radius={9} compact
            title="Blood Oxygen (SpO₂)"
            description="Oxygen saturation while asleep. Above 95% normal, 97%+ excellent. Repeated drops below 90% may indicate sleep apnea — worth discussing with a physician."
            source="Garmin Fenix 7X">
            <HealthStatusTile label="SpO₂" value={m.vitals.spo2.avg} unit="%" data={m.vitals.spo2.trend || []} inRange={m.vitals.spo2.avg >= 95} accent={accent} sub={m.vitals.spo2.avg >= 97 ? 'excellent' : 'normal'} />
          </InfoCard>
        )}
      </div>
    </RecScroll>
  );
}

Object.assign(window, { SleepView: SleepViewV3 });
