/* bacta-sleep.jsx — Sleep channel (Overview + Trends).
   Anchors: Duration + Score. Star: stage architecture (hypnogram, not a table). */

function StageStat({ s, total }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', background: color.base, border: `1px solid ${color.line}`, borderRadius: 8, padding: '9px 11px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, opacity: s.key === 'awake' ? 0.5 : 1, flexShrink: 0 }} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>{s.label}</span>
        <span style={{ marginLeft: 'auto', fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text3 }}>{s.key === 'awake' ? '' : s.pct + '%'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 16, fontWeight: 700, color: color.text, lineHeight: 1 }}>{Math.floor(s.mins / 60)}h {String(s.mins % 60).padStart(2, '0')}m</span>
      </div>
      <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${(s.mins / total) * 100}%`, height: '100%', background: s.color, opacity: s.key === 'awake' ? 0.5 : 1, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function SleepView({ tab }) {
  const { color } = BACTA;
  const accent = BACTA.section.sleep.accent;
  const m = BACTA.metrics.sleep;
  const total = m.stages.reduce((a, s) => a + s.mins, 0);

  if (tab === 'trends') {
    const avgDur = Math.round(m.duration.trend.reduce((a, b) => a + b, 0) / 7);
    const avgScore = Math.round(m.score.trend.reduce((a, b) => a + b, 0) / 7);
    return (
      <RecScroll>
        <MX4Briefing channel="sleep" brief={BACTA.brief.sleep} label="SLEEP" />
        <Rail label="7-NIGHT DURATION" accent={accent} right={`AVG ${(avgDur / 60).toFixed(1)}H`} />
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden', marginBottom: 11 }}>
          <Bracket color={accent} inset={6} op={0.35} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>HOURS ASLEEP</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.duration.h}h {String(m.duration.m).padStart(2, '0')}m</span>
            </span>
          </div>
          <Bars7 data={m.duration.trend} accent={accent} h={80} fmt={(v) => (v / 60).toFixed(1)} />
        </div>
        <Rail label="SLEEP SCORE" accent={accent} right={`AVG ${avgScore}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <TrendRow label="Score" value={m.score.value} sub={m.score.state} data={m.score.trend} accent={accent} delta={m.score.trend[6] - m.score.trend[0]} kind="bars" />
          <TrendRow label="Duration" value={`${m.duration.h}.${Math.round(m.duration.m / 6)}`} unit="h" data={m.duration.trend} accent={accent} delta={m.duration.trend[6] - m.duration.trend[0]} />
        </div>
      </RecScroll>
    );
  }

  /* ── OVERVIEW ── */
  return (
    <RecScroll>
      <MX4Briefing channel="sleep" brief={BACTA.brief.sleep} label="SLEEP" />
      <Rail label="LAST NIGHT" accent={accent} right="11:42 — 06:31" />

      {/* Anchors: Duration + Score */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, background: `linear-gradient(150deg, ${hexA(accent, 0.1)}, ${color.surface} 60%)`, border: `1px solid ${hexA(accent, 0.32)}`, borderRadius: 13, padding: '15px 16px', overflow: 'hidden', marginBottom: 11 }}>
        <Bracket color={accent} inset={7} op={0.4} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.14em', color: color.text3, marginBottom: 6 }}>TIME ASLEEP</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 38, fontWeight: 700, color: color.text, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{m.duration.h}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 15, color: color.text3, marginRight: 6 }}>h</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 38, fontWeight: 700, color: color.text, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{String(m.duration.m).padStart(2, '0')}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 15, color: color.text3 }}>m</span>
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: color.text3, marginTop: 7 }}>{BACTA.fmtDur(m.duration.inBed)} in bed · {m.stages[3].mins}m awake</div>
        </div>
        <Gauge value={m.score.value} accent={accent} size={96} stroke={6}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 26, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.score.value}</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, letterSpacing: '0.12em', color: accent, marginTop: 2 }}>{m.score.state.toUpperCase()}</span>
        </Gauge>
      </div>

      {/* Stage architecture — the star: Depth Field over a proportional Split Bar */}
      <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 12, padding: '13px 14px 13px', overflow: 'hidden', marginBottom: 11 }}>
        <Bracket color={accent} inset={6} op={0.32} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>Architecture</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3, letterSpacing: '0.06em' }}>7H 40M CYCLED</span>
        </div>
        <SleepDepth hypno={m.hypno} accent={accent} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, marginBottom: 14 }}>
          {['11:42p', '02:00', '04:00', '06:31a'].map(tk => <span key={tk} style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3 }}>{tk}</span>)}
        </div>
        <StageSplit stages={m.stages} />
        <div style={{ marginTop: 12 }}>
          <StageLegend stages={m.stages} />
        </div>
      </div>

      <Rail label="OXYGEN & BREATH" accent={accent} right="ASLEEP" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 8, padding: '11px 12px', overflow: 'hidden' }}>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.text3, fontWeight: 600, marginBottom: 7 }}>SpO2 · sleep</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 22, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.spo2.avg}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text3 }}>{m.spo2.unit} avg</span>
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3, marginTop: 6 }}>LOW <span style={{ color: color.amber, fontWeight: 600 }}>{m.spo2.low}%</span></div>
        </div>
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 8, padding: '11px 12px', overflow: 'hidden' }}>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.text3, fontWeight: 600, marginBottom: 7 }}>Respiration</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 22, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.resp.avg}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text3 }}>{m.resp.unit}</span>
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3, marginTop: 6 }}>steady overnight</div>
        </div>
      </div>
    </RecScroll>
  );
}

Object.assign(window, { SleepView, StageStat });
