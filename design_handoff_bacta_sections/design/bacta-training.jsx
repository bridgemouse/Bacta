/* bacta-training.jsx — Training channel (Overview + Trends).
   Anchors: Training Status + VO2max. Recent activity reads as a log, not a row. */

function LoadBand({ value, low, high, accent }) {
  const { color } = BACTA;
  const lo = 200, hi = 480;
  const pos = (x) => `${Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100))}%`;
  return (
    <div>
      <div style={{ position: 'relative', width: '100%', height: 12, borderRadius: 6, background: color.base, border: `1px solid ${color.line}`, overflow: 'hidden' }}>
        {/* optimal zone */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(low), right: `calc(100% - ${pos(high)})`, background: hexA(accent, 0.22) }} />
        {/* marker */}
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: pos(value), width: 3, background: accent, boxShadow: `0 0 8px ${accent}`, borderRadius: 2, transform: 'translateX(-50%)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>
        <span>LOW</span><span style={{ color: accent }}>OPTIMAL {low}–{high}</span><span>HIGH</span>
      </div>
    </div>
  );
}

function TrainingView({ tab }) {
  const { color } = BACTA;
  const accent = BACTA.section.training.accent;
  const m = BACTA.metrics.training;

  if (tab === 'trends') {
    return (
      <RecScroll>
        <MX4Briefing channel="training" brief={BACTA.brief.training} label="TRAINING" />
        <Rail label="7-DAY INTENSITY" accent={accent} right={`GOAL ${m.intensity.goal}/WK`} />
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden', marginBottom: 11 }}>
          <Bracket color={accent} inset={6} op={0.35} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>INTENSITY MIN / DAY</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.intensity.trend.reduce((a, b) => a + b, 0)}<span style={{ fontSize: 10, color: color.text3 }}> wk</span></span>
          </div>
          <Bars7 data={m.intensity.trend} accent={accent} h={80} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <TrendRow label="Load" value={m.load.value} sub={m.load.state} data={m.load.trend} accent={accent} delta={m.load.trend[6] - m.load.trend[0]} kind="bars" />
          <TrendRow label="VO2max" value={m.vo2max.value} unit="ml" data={m.status.trend} accent={accent} delta={m.status.trend[6] - m.status.trend[0]} />
          <TrendRow label="Endurance" value={m.endurance.value} sub={m.endurance.state} data={m.endurance.trend} accent={accent} delta={m.endurance.trend[6] - m.endurance.trend[0]} />
        </div>
      </RecScroll>
    );
  }

  /* ── OVERVIEW ── */
  return (
    <RecScroll>
      <MX4Briefing channel="training" brief={BACTA.brief.training} label="TRAINING" />
      <Rail label="STATUS" accent={accent} right={m.status.sub.toUpperCase()} />
      <div style={{ marginBottom: 11 }}>
        <StatusBanner status={m.status.value} sub={m.status.sub} accent={accent} />
      </div>

      {/* VO2max + Endurance anchors */}
      <div style={{ display: 'flex', gap: 9 }}>
        <HeadlineCard accent={accent} label="VO2max"
          foot={<span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>FITNESS AGE <span style={{ color: accent, fontWeight: 600 }}>{m.vo2max.fitnessAge}</span></span>}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.vo2max.value}</span>
            <Delta value={m.vo2max.delta} size={10} />
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3, marginTop: 7, paddingLeft: 3 }}>{m.vo2max.unit}</div>
        </HeadlineCard>

        <HeadlineCard accent={accent} label="Endurance"
          foot={<Sparkline data={m.endurance.trend} accent={accent} w={150} h={24} sw={1.7} />}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 30, fontWeight: 700, color: color.text, lineHeight: 1 }}>{m.endurance.value}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, color: color.text3 }}>/100</span>
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: accent, marginTop: 7, paddingLeft: 3, letterSpacing: '0.06em' }}>{m.endurance.state.toUpperCase()}</div>
        </HeadlineCard>
      </div>

      {/* Training Load band */}
      <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 12px', overflow: 'hidden', marginTop: 9 }}>
        <Bracket color={accent} inset={6} op={0.32} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>Acute Load</span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.load.value}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: accent, letterSpacing: '0.06em' }}>{m.load.state.toUpperCase()}</span>
          </span>
        </div>
        <LoadBand value={m.load.value} low={m.load.low} high={m.load.high} accent={accent} />
      </div>

      {/* Intensity minutes */}
      <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 12px', overflow: 'hidden', marginTop: 9 }}>
        <Bracket color={accent} inset={6} op={0.32} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>Intensity Minutes</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>THIS WEEK</span>
        </div>
        <IntensityBar moderate={m.intensity.moderate} vigorous={m.intensity.vigorous} goal={m.intensity.goal} accent={accent} />
      </div>

      <Rail label="ACTIVITY LOG" accent={accent} right={`${m.activities.length} SESSIONS`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {m.activities.map((a, i) => <LogEntry key={i} a={a} accent={accent} />)}
      </div>
    </RecScroll>
  );
}

Object.assign(window, { TrainingView, LoadBand });
