/* bacta-home.jsx — Home channel.
   Overview = MX-4's synthesis briefing (tone-colored) + the Round-1 System Card
   grid, with live channels bright/tappable and not-yet-wired ones dimmed.
   Trends = the week read across the live channels. */

/* Dimmed placeholder card — matches SystemCard footprint so the grid stays aligned.
   No fabricated numbers: it just says the channel is still calibrating. */
function PendingCard({ tileKey, idx, onClick }) {
  const { color } = BACTA;
  const s = BACTA.section[tileKey];
  const accent = s.accent;
  return (
    <button onClick={onClick} style={{ position: 'relative', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: onClick ? 'pointer' : 'default', background: color.base, border: `1px dashed ${color.line}`, borderRadius: 7, padding: '12px 13px 11px', minHeight: 116, display: 'flex', flexDirection: 'column', overflow: 'hidden', opacity: 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingLeft: 4 }}>
        <span style={{ opacity: 0.7 }}><Sigil name={tileKey} color={accent} size={14} /></span>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text3, fontWeight: 600 }}>{s.label}</span>
        <span style={{ marginLeft: 'auto', fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>{String(idx + 1).padStart(2, '0')}</span>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', border: `1.5px solid ${color.text3}` }} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.1em', color: color.text3 }}>CALIBRATING</span>
      </div>
    </button>
  );
}

function HomeView({ tab, onOpenSection }) {
  const { color } = BACTA;
  const accent = BACTA.home.accent;

  if (tab === 'trends') {
    const m = BACTA.metrics;
    return (
      <RecScroll>
        <MX4Briefing channel="home" brief={BACTA.brief.home} label="OVERVIEW" />
        <Rail label="WEEK IN REVIEW" accent={accent} right="3 CHANNELS" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <TrendRow label="Recovery" value={m.recovery.score.value} sub="readiness" data={m.recovery.score.trend} accent={BACTA.section.recovery.accent} delta={m.recovery.score.trend[6] - m.recovery.score.trend[0]} kind="bars" />
          <TrendRow label="HRV" value={m.recovery.hrv.value} unit="ms" data={m.recovery.hrv.trend} accent={BACTA.section.recovery.accent} delta={m.recovery.hrv.trend[6] - m.recovery.hrv.trend[0]} />
          <TrendRow label="Sleep" value={`${m.sleep.duration.h}.${Math.round(m.sleep.duration.m / 6)}`} unit="h" data={m.sleep.duration.trend} accent={BACTA.section.sleep.accent} delta={m.sleep.duration.trend[6] - m.sleep.duration.trend[0]} kind="bars" fmt={(v) => (v / 60).toFixed(1)} />
          <TrendRow label="Load" value={m.training.load.value} sub={m.training.load.state} data={m.training.load.trend} accent={BACTA.section.training.accent} delta={m.training.load.trend[6] - m.training.load.trend[0]} />
          <TrendRow label="Intensity" value={m.training.intensity.trend.reduce((a, b) => a + b, 0)} unit="min" data={m.training.intensity.trend} accent={BACTA.section.training.accent} delta={m.training.intensity.trend[6] - m.training.intensity.trend[0]} kind="bars" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 0 4px' }}>
          <MX4Sigil color={BACTA.mx4Color} size={14} spin mood="think" />
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.1em', color: color.text3 }}>SYNTHESIZED FROM 3 LIVE CHANNELS</span>
        </div>
      </RecScroll>
    );
  }

  /* ── OVERVIEW — MX-4 synthesizes, then the System Card grid (Round-1 layout) ── */
  return (
    <RecScroll>
      <MX4Briefing channel="home" brief={BACTA.brief.home} label="DAILY BRIEFING" />
      <Rail label="SYSTEMS" accent={accent} right="3 ONLINE · 3 CALIBRATING" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {BACTA.tiles.map((t, i) => (
          BACTA.pending.includes(t.key)
            ? <PendingCard key={t.key} tileKey={t.key} idx={i} onClick={onOpenSection ? () => onOpenSection(t.key) : undefined} />
            : <SystemCard key={t.key} t={t} idx={i} onClick={onOpenSection ? () => onOpenSection(t.key) : undefined} />
        ))}
      </div>
    </RecScroll>
  );
}

Object.assign(window, { HomeView, PendingCard });
