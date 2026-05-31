/* bacta-viz.jsx — Round-2 instrument primitives. All inline-styled, channel-
   accent driven. Exports: SectionTabs, Gauge, Delta, BodyBattery, StageBar,
   Hypnogram, Bars7, IntensityBar, TrendRow, VitalTile, StatusBanner, LogEntry,
   Rail, ActivityGlyph, MX4Briefing. */

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const UI = "'Hanken Grotesk', system-ui, sans-serif";

/* ── Overview / Trends segmented control — chamfered "tech panel" to match
   MX-4's hex/bracket droid language (lives in the dock cluster) ───── */
function SectionTabs({ accent, tab, onTab }) {
  const { color } = BACTA;
  const items = [['overview', 'Overview'], ['trends', 'Trends']];
  const oct = (c) => `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;
  return (
    <div style={{ clipPath: oct(7), background: hexA(accent, 0.45), padding: 1.5, flexShrink: 0 }}>
      <div style={{ clipPath: oct(6), background: color.base, display: 'flex', gap: 3, padding: 3 }}>
        {items.map(([k, lbl]) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => onTab(k)} style={{
              font: 'inherit', cursor: 'pointer', border: 'none', clipPath: oct(4), padding: '7px 14px',
              fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: on ? hexA(accent, 0.2) : 'transparent',
              color: on ? accent : color.text3 }}>
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── 270° instrument gauge ─────────────────────────────────────── */
function Gauge({ value, max = 100, accent, size = 116, stroke = 7, children, glow = true }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const arc = 0.74;
  const prog = Math.max(0, Math.min(1, value / max));
  const rot = 90 + (1 - arc) * 180; // gap centered at bottom
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <g transform={`rotate(${rot} ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeDasharray={`${arc * C} ${C}`} strokeLinecap="round" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={stroke} strokeDasharray={`${arc * prog * C} ${C}`} strokeLinecap="round"
            style={{ filter: glow ? `drop-shadow(0 0 5px ${hexA(accent, 0.5)})` : 'none', transition: 'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)' }} />
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>{children}</div>
    </div>
  );
}

/* ── delta badge ───────────────────────────────────────────────── */
function Delta({ value, unit = '', lowerBetter = false, size = 10 }) {
  const { color } = BACTA;
  if (value === 0 || value == null) return (
    <span style={{ fontFamily: MONO, fontSize: size, color: color.text3, letterSpacing: '0.02em' }}>±0{unit}</span>
  );
  const up = value > 0;
  const good = lowerBetter ? !up : up;
  const c = good ? color.green : color.red;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: MONO, fontSize: size, color: c, fontWeight: 600, letterSpacing: '0.02em' }}>
      <span style={{ fontSize: size - 1 }}>{up ? '\u25B2' : '\u25BC'}</span>{Math.abs(value)}{unit}
    </span>
  );
}

/* ── Body Battery — charge cell from min to max with live marker ── */
function BodyBattery({ now, max, min, accent, height = 13 }) {
  const { color } = BACTA;
  const lo = (min / 100) * 100, span = ((max - min) / 100) * 100, mark = now;
  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: height / 2, background: color.base, border: `1px solid ${color.line}`, overflow: 'hidden' }}>
      {/* depletion-to-peak band */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${lo}%`, width: `${span}%`, background: `linear-gradient(90deg, ${hexA(accent, 0.25)}, ${hexA(accent, 0.6)})` }} />
      {/* current fill */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${mark}%`, background: `linear-gradient(90deg, ${hexA(accent, 0.15)}, ${accent})`, boxShadow: `0 0 8px ${hexA(accent, 0.5)}` }} />
      {/* tick marks */}
      {[25, 50, 75].map(t => <span key={t} style={{ position: 'absolute', top: 2, bottom: 2, left: `${t}%`, width: 1, background: 'rgba(0,0,0,0.4)' }} />)}
    </div>
  );
}

/* ── Sleep stage stacked bar ────────────────────────────────────── */
function StageBar({ stages, height = 16 }) {
  const total = stages.reduce((s, x) => s + x.mins, 0);
  return (
    <div style={{ display: 'flex', width: '100%', height, borderRadius: 5, overflow: 'hidden', gap: 2, background: 'transparent' }}>
      {stages.map(s => (
        <div key={s.key} title={s.label} style={{ width: `${(s.mins / total) * 100}%`, background: s.color, opacity: s.key === 'awake' ? 0.4 : 1, borderRadius: 2 }} />
      ))}
    </div>
  );
}

/* ── Overnight hypnogram (stepped) ──────────────────────────────── */
function Hypnogram({ data, stages, w = 332, h = 76 }) {
  // level 3=deep(bottom) .. 0=awake(top). map to lanes.
  const lanes = ['Awake', 'REM', 'Light', 'Deep'];
  const laneColor = { 0: '#56657a', 1: '#c4b5fd', 2: '#a78bfa', 3: '#7c5cff' };
  const n = data.length;
  const padL = 30, padR = 6, padT = 6, padB = 6;
  const iw = w - padL - padR, ih = h - padT - padB;
  const x = (i) => padL + (i / n) * iw;
  const y = (lv) => padT + (lv / 3) * (ih - 8) + 4;
  // build stepped path
  let d = '';
  data.forEach((lv, i) => {
    const x0 = x(i), x1 = x(i + 1), yy = y(lv);
    d += (i === 0 ? `M${x0} ${yy}` : `L${x0} ${yy}`) + ` L${x1} ${yy}`;
  });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      {lanes.map((lbl, lv) => (
        <g key={lv}>
          <line x1={padL} y1={y(lv)} x2={w - padR} y2={y(lv)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={0} y={y(lv) + 3} fontFamily={MONO} fontSize="7.5" letterSpacing="0.04em" fill="#56657a">{lbl.toUpperCase()}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.45))' }} />
      {/* stage dots at transitions */}
      {data.map((lv, i) => i % 1 === 0 ? null : null)}
    </svg>
  );
}

/* ── 7-day bar chart ────────────────────────────────────────────── */
function Bars7({ data, accent, labels = BACTA.day, h = 70, goal, fmt }) {
  const max = Math.max(...data, goal || 0) * 1.12 || 1;
  const min = 0;
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: h }}>
        {data.map((v, i) => {
          const last = i === data.length - 1;
          const hp = ((v - min) / (max - min)) * 100;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 7.5, color: last ? accent : 'transparent', fontWeight: 600 }}>{fmt ? fmt(v) : v}</span>
              <div style={{ width: '100%', height: `${Math.max(hp, 3)}%`, borderRadius: 3,
                background: last ? accent : hexA(accent, 0.28),
                boxShadow: last ? `0 0 8px ${hexA(accent, 0.5)}` : 'none', transition: 'height .8s cubic-bezier(.4,0,.2,1)' }} />
            </div>
          );
        })}
      </div>
      {goal != null && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${((goal - min) / (max - min)) * h + 18}px`, borderTop: `1px dashed ${hexA(BACTA.color.text2, 0.45)}` }} />
      )}
      <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        {labels.map((l, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 8, color: i === labels.length - 1 ? accent : BACTA.color.text3, fontWeight: i === labels.length - 1 ? 700 : 400 }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Weekly intensity minutes (moderate + vigorous toward goal) ─── */
function IntensityBar({ moderate, vigorous, goal, accent }) {
  const { color } = BACTA;
  const weighted = moderate + vigorous * 2; // garmin weighting
  const scale = Math.max(weighted, goal) * 1.05;
  return (
    <div>
      <div style={{ position: 'relative', width: '100%', height: 14, borderRadius: 7, background: color.base, border: `1px solid ${color.line}`, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${(moderate / scale) * 100}%`, background: hexA(accent, 0.45) }} />
        <div style={{ width: `${(vigorous * 2 / scale) * 100}%`, background: accent, boxShadow: `0 0 8px ${hexA(accent, 0.5)}` }} />
        <span style={{ position: 'absolute', top: -1, bottom: -1, left: `${(goal / scale) * 100}%`, width: 2, background: color.text, opacity: 0.7 }} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 9 }}>
        {[['Moderate', moderate, hexA(accent, 0.5)], ['Vigorous', vigorous, accent]].map(([l, v, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: color.text2 }}>{l} <span style={{ color: color.text, fontWeight: 600 }}>{v}</span></span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 9, color: color.text3 }}>GOAL {goal}</span>
      </div>
    </div>
  );
}

/* ── Trend row (Trends tab) ─────────────────────────────────────── */
function TrendRow({ label, value, unit, sub, data, accent, delta, lowerBetter, kind = 'spark', fmt }) {
  const { color } = BACTA;
  const d = data[data.length - 1] - data[0];
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, background: color.surface, border: `1px solid ${color.line}`, borderRadius: 9, padding: '11px 13px', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, background: accent, opacity: 0.7 }} />
      <div style={{ minWidth: 84, flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: color.text, lineHeight: 1 }}>{value}</span>
          {unit && <span style={{ fontFamily: MONO, fontSize: 9, color: color.text3 }}>{unit}</span>}
        </div>
        {(delta !== undefined || sub) && (
          <div style={{ marginTop: 4 }}>{delta !== undefined ? <Delta value={delta} lowerBetter={lowerBetter} size={9} /> : <span style={{ fontFamily: MONO, fontSize: 9, color: color.text3 }}>{sub}</span>}</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kind === 'bars'
          ? <Bars7 data={data} accent={accent} h={42} fmt={fmt} />
          : <Sparkline data={data} accent={accent} w={180} h={42} sw={1.8} />}
      </div>
    </div>
  );
}

/* ── Compact secondary vital tile ───────────────────────────────── */
function VitalTile({ label, value, unit, data, accent, delta, lowerBetter }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 8, padding: '10px 11px 9px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.text3, fontWeight: 600 }}>{label}</span>
        {delta !== undefined && <Delta value={delta} lowerBetter={lowerBetter} size={8.5} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: color.text, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontFamily: MONO, fontSize: 9, color: color.text3 }}>{unit}</span>}
      </div>
      {data && <Sparkline data={data} accent={accent} w={120} h={18} sw={1.5} dot={false} fill={false} />}
    </div>
  );
}

/* ── Training status banner ─────────────────────────────────────── */
function StatusBanner({ status, sub, accent }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: `linear-gradient(120deg, ${hexA(accent, 0.14)}, ${color.surface} 70%)`, border: `1px solid ${hexA(accent, 0.4)}`, borderRadius: 11, overflow: 'hidden' }}>
      <Bracket color={accent} inset={6} op={0.4} />
      <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hexA(accent, 0.15), border: `1px solid ${hexA(accent, 0.35)}` }}>
        <Sigil name="training" color={accent} size={22} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.16em', color: color.text3, marginBottom: 3 }}>TRAINING STATUS</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: UI, fontSize: 20, fontWeight: 750, color: accent, letterSpacing: '-0.01em' }}>{status}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: color.text2 }}>{sub}</span>
        </div>
      </div>
      <StatusCore accent={accent} size={7} />
    </div>
  );
}

/* ── Activity glyphs (for the training log) ─────────────────────── */
function ActivityGlyph({ name, color = '#fff', size = 16 }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const v = {
    run: <g {...p}><circle cx="15.5" cy="5" r="1.8" /><path d="M14 9.5 L10 12 L12.5 14.5 L11 20" /><path d="M14 9.5 L17.5 11.5 L20 10" /><path d="M12.5 14.5 L16 16 L18 21" /><path d="M10 12 L6 11.5" /></g>,
    strength: <g {...p}><line x1="4" y1="9" x2="4" y2="15" /><line x1="20" y1="9" x2="20" y2="15" /><line x1="7" y1="7" x2="7" y2="17" /><line x1="17" y1="7" x2="17" y2="17" /><line x1="7" y1="12" x2="17" y2="12" /></g>,
  }[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>{v}</svg>;
}

/* ── Recent-activity log entry ──────────────────────────────────── */
function LogEntry({ a, accent }) {
  const { color } = BACTA;
  const stats = [a.dist, a.dur, a.kcal + ' kcal', a.hr + ' bpm'].filter(Boolean);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, background: color.surface, border: `1px solid ${color.line}`, borderRadius: 8, padding: '10px 12px', overflow: 'hidden' }}>
      <span style={{ fontFamily: MONO, fontSize: 13, color: accent, marginRight: -4 }}>{'\u203A'}</span>
      <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hexA(accent, 0.13), border: `1px solid ${hexA(accent, 0.3)}` }}>
        <ActivityGlyph name={a.sigil} color={accent} size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: UI, fontSize: 14, fontWeight: 650, color: color.text }}>{a.type}</span>
          <span style={{ fontFamily: MONO, fontSize: 8.5, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{a.feel}</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: color.text2, marginTop: 3, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {stats.join('  \u00b7  ')}
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 8, color: color.text3, flexShrink: 0, textAlign: 'right', letterSpacing: '0.04em' }}>{a.when}</span>
    </div>
  );
}

/* ── Section divider rail ───────────────────────────────────────── */
function Rail({ label, accent, right }) {
  const { color } = BACTA;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '16px 0 11px' }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: accent, fontWeight: 600 }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${hexA(accent, 0.4)}, ${color.line})` }} />
      {right && <span style={{ fontFamily: MONO, fontSize: 9, color: color.text3, letterSpacing: '0.06em' }}>{right}</span>}
    </div>
  );
}

/* ── MX-4 briefing card — TONE drives the aura; cyan sigil keeps identity ── */
function MX4Briefing({ channel, brief, label }) {
  const { color } = BACTA;
  const accent = channel === 'home'
    ? BACTA.home.accent
    : (BACTA.section[channel] ? BACTA.section[channel].accent : BACTA.mx4Color);
  const tone = BACTA.toneColor(brief.tone);
  const cy = (x) => hexA(accent, x);
  const toneWord = { positive: 'POSITIVE', caution: 'CAUTION', flag: 'FLAG' }[brief.tone];
  return (
    <div style={{ position: 'relative', borderRadius: 14, marginBottom: 4, overflow: 'hidden',
      background: `linear-gradient(160deg, ${cy(0.12)}, ${color.surface} 52%)`,
      border: `1px solid ${cy(0.4)}`, boxShadow: `0 0 26px ${cy(0.1)}, inset 0 0 30px ${cy(0.04)}` }}>
      {/* card wears the section's channel color; the TONE lives only in the verdict badge */}
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent 75%)` }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 15px 0' }}>
        <MX4Sigil color={accent} size={21} spin glow mood={brief.mood} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: accent, fontWeight: 700 }}>MX-4 <span style={{ color: color.text3 }}>//</span> {label}</span>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', color: color.text3 }}>{brief.meta}</span>
        </div>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: hexA(tone, 0.14), border: `1px solid ${hexA(tone, 0.45)}` }}>
          <StatusCore accent={tone} size={6} />
          <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.1em', color: tone, fontWeight: 700 }}>{toneWord}</span>
        </span>
      </div>
      <div style={{ position: 'relative', padding: '11px 15px 8px' }}>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, color: '#eef4fb', fontWeight: 450, letterSpacing: '-0.005em', textWrap: 'pretty' }}>
          {brief.line}<span style={{ display: 'inline-block', width: 6, height: 14, marginLeft: 3, background: accent, verticalAlign: '-2px', animation: 'mx4blink 1.1s step-end infinite' }} />
        </p>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 15px 12px', borderTop: `1px solid ${cy(0.16)}`, marginTop: 3, flexWrap: 'wrap' }}>
        {brief.chips.map(([k, v]) => (
          <span key={k} style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.06em', color: color.text3, border: `1px solid ${color.line}`, borderRadius: 4, padding: '3px 7px' }}>
            {k} <span style={{ color: accent }}>{v}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}><FTelemetry color={accent} bars={5} /></span>
      </div>
    </div>
  );
}

/* ── Depth Field — filled topographic "how deep" chart (Sleep) ───── */
function SleepDepth({ hypno, accent, w = 334, h = 86 }) {
  const padT = 6, padB = 4, ih = h - padT - padB, n = hypno.length;
  const x = (i) => (i / n) * w;
  const y = (lv) => padT + (lv / 3) * ih; // deeper = lower
  let line = '';
  hypno.forEach((lv, i) => { const yy = y(lv); line += (i === 0 ? `M0 ${yy}` : `L${x(i)} ${yy}`) + ` L${x(i + 1)} ${yy}`; });
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const id = 'dep' + Math.random().toString(36).slice(2, 6);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.05" />
          <stop offset="1" stopColor="#7c5cff" stopOpacity="0.42" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map(lv => <line key={lv} x1="0" y1={y(lv)} x2={w} y2={y(lv)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${hexA(accent, 0.5)})` }} />
    </svg>
  );
}

/* ── Stage Split — proportional breakdown bar (Sleep) ───────────── */
function StageSplit({ stages }) {
  const total = stages.reduce((a, s) => a + s.mins, 0);
  return (
    <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
      {stages.map(s => (
        <div key={s.key} style={{ width: `${(s.mins / total) * 100}%`, background: s.color, opacity: s.key === 'awake' ? 0.45 : 1, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.pct >= 18 && <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#0b0d12' }}>{s.pct}%</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Stage Legend — compact durations + % chips (Sleep) ─────────── */
function StageLegend({ stages }) {
  const { color } = BACTA;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 14px' }}>
      {stages.map(s => (
        <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, opacity: s.key === 'awake' ? 0.5 : 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: color.text2 }}>{s.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: color.text, fontWeight: 600 }}>{Math.floor(s.mins / 60)}h {String(s.mins % 60).padStart(2, '0')}m</span>
          {s.key !== 'awake' && <span style={{ fontFamily: MONO, fontSize: 8.5, color: color.text3 }}>{s.pct}%</span>}
        </span>
      ))}
    </div>
  );
}

Object.assign(window, {
  SectionTabs, Gauge, Delta, BodyBattery, StageBar, Hypnogram, Bars7, IntensityBar,
  TrendRow, VitalTile, StatusBanner, ActivityGlyph, LogEntry, Rail, MX4Briefing,
  SleepDepth, StageSplit, StageLegend,
});
