/* bacta-v3-viz.jsx — New viz primitives for v3.
   BodyBatteryArc, HRVDirectionBadge, LoadRatioRow, WeeklyVolumeBars,
   FitnessAgeLine, SleepArchBadge, SleepConsistencyCard,
   LogEntryV3 (expandable), TrainingEffectBars, RunDynamicsGrid, ActivityZoneBar.
   Load after bacta-viz-v2.jsx. */

const { useState: useStateLEV3 } = React;

// ── Body Battery Intraday Arc ──────────────────────────────────────────────
function BodyBatteryArc({ data }) {
  const { color } = BACTA;
  const accent = BACTA.section.recovery.accent;
  const W = 320, H = 98;
  const pL = 26, pR = 6, pT = 14, pB = 20;
  const iw = W - pL - pR, ih = H - pT - pB;
  const pts = data.points, n = pts.length;

  const px = i => pL + (i / (n - 1)) * iw;
  const py = v => pT + ih - (v / 100) * ih;

  const linePts = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ');
  const areaPts = `${linePts} L${px(n-1).toFixed(1)},${pT+ih} L${pL},${pT+ih} Z`;

  const wakeX  = px(data.wakeIdx);
  const curPt  = pts[data.currentIdx];
  const curX   = px(data.currentIdx);
  const curY   = py(curPt.v);
  const dotC   = curPt.v >= 75 ? color.green : curPt.v >= 25 ? color.amber : color.red;
  const gid    = 'bbarc_a';
  const runIdx = pts.findIndex(p => p.event === 'run');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.30" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Sleep zone fill */}
      <rect x={pL} y={pT} width={wakeX - pL} height={ih}
        fill={hexA(accent, 0.06)} rx="2" />
      <text x={pL + (wakeX - pL) / 2} y={H - 3} textAnchor="middle"
        fontSize="7" fill={hexA(accent, 0.45)} fontFamily={BACTA.FONT_MONO} letterSpacing="0.06em">
        SLEEP
      </text>

      {/* Grid lines at 25, 50, 75 */}
      {[25, 50, 75].map(v => (
        <line key={v} x1={pL} y1={py(v).toFixed(1)} x2={W - pR} y2={py(v).toFixed(1)}
          stroke={hexA(color.text3, 0.14)} strokeWidth="1" strokeDasharray="2,5" />
      ))}

      {/* Area */}
      <path d={areaPts} fill={`url(#${gid})`} />

      {/* Main line */}
      <path d={linePts} fill="none" stroke={accent} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Wake marker */}
      <line x1={wakeX.toFixed(1)} y1={pT - 2} x2={wakeX.toFixed(1)} y2={pT + ih}
        stroke={hexA(color.green, 0.55)} strokeWidth="1.5" strokeDasharray="3,3" />
      <text x={wakeX} y={pT - 4} textAnchor="middle"
        fontSize="7" fill={color.green} fontFamily={BACTA.FONT_MONO} letterSpacing="0.06em">
        WAKE
      </text>

      {/* Run event dot */}
      {runIdx >= 0 && (
        <circle cx={px(runIdx).toFixed(1)} cy={py(pts[runIdx].v).toFixed(1)} r="4.5"
          fill={hexA(BACTA.section.training.accent, 0.18)}
          stroke={BACTA.section.training.accent} strokeWidth="1.5" />
      )}

      {/* Y-axis labels */}
      {[0, 50, 100].map(v => (
        <text key={v} x={pL - 3} y={py(v) + 3}
          textAnchor="end" fontSize="7" fill={hexA(color.text3, 0.65)} fontFamily={BACTA.FONT_MONO}>
          {v}
        </text>
      ))}

      {/* X-axis time labels — every 3rd point */}
      {pts.map((p, i) => (i % 3 === 0 || i === n - 1) && (
        <text key={i} x={px(i)} y={H - 3} textAnchor="middle"
          fontSize="7" fill={hexA(color.text3, i === n - 1 ? 0.9 : 0.55)} fontFamily={BACTA.FONT_MONO}>
          {p.h}
        </text>
      ))}

      {/* Current value dot */}
      <circle cx={curX.toFixed(1)} cy={curY.toFixed(1)} r="9"
        fill={hexA(dotC, 0.18)} />
      <circle cx={curX.toFixed(1)} cy={curY.toFixed(1)} r="4.5"
        fill={dotC} />
      <text x={curX + 8} y={curY - 6} fontSize="8" fill={dotC}
        fontFamily={BACTA.FONT_MONO} fontWeight="700">
        {curPt.v}
      </text>
    </svg>
  );
}

// ── HRV Direction Badge ────────────────────────────────────────────────────
function HRVDirectionBadge({ dir }) {
  const { color } = BACTA;
  const c = dir.direction === 'up' ? color.green
    : dir.direction === 'down' ? color.red : color.amber;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 5,
      background: hexA(c, 0.11), border: `1px solid ${hexA(c, 0.38)}` }}>
      <StatusCore accent={c} size={5} />
      <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, fontWeight: 700,
        letterSpacing: '0.08em', color: c }}>{dir.label}</span>
      <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
        color: hexA(c, 0.85) }}>{dir.sub}</span>
    </div>
  );
}

// ── Load Ratio Row ─────────────────────────────────────────────────────────
function LoadRatioRow({ ratio, accent }) {
  const { color } = BACTA;
  const c = ratio.state === 'Optimal' ? accent
    : ratio.state === 'Under' ? color.amber : color.red;
  const clamp = v => Math.max(0, Math.min(1, v));
  const pos  = clamp((ratio.value - 0.5) / 1.0);
  const optL = clamp((0.8 - 0.5) / 1.0);
  const optR = clamp((1.3 - 0.5) / 1.0);
  return (
    <div style={{ background: hexA(accent, 0.04), border: `1px solid ${hexA(accent, 0.2)}`,
      borderRadius: 8, padding: '10px 13px', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.12em',
          color: color.text2, fontWeight: 600 }}>LOAD RATIO · ACUTE : CHRONIC</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700,
            color: color.text, lineHeight: 1 }}>{ratio.value.toFixed(2)}</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, fontWeight: 700,
            letterSpacing: '0.1em', color: c }}>{ratio.state.toUpperCase()}</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'visible',
        background: hexA(color.text3, 0.1), marginBottom: 5 }}>
        <div style={{ position: 'absolute', left: `${optL * 100}%`,
          width: `${(optR - optL) * 100}%`, height: '100%',
          background: hexA(accent, 0.2), borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: '-2px',
          left: `calc(${pos * 100}% - 6px)`,
          width: 12, height: 12, borderRadius: '50%',
          background: c, boxShadow: `0 0 6px ${hexA(c, 0.5)}` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>
          {ratio.acute} acute · {ratio.chronic} chronic (28d)
        </span>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: hexA(color.green, 0.7) }}>
          optimal 0.8–1.3
        </span>
      </div>
    </div>
  );
}

// ── Weekly Volume Bars (6-week) ────────────────────────────────────────────
function WeeklyVolumeBars({ data, accent }) {
  const { color } = BACTA;
  const maxH = Math.max(...data.map(d => d.h));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
        {data.map((d, i) => {
          const pct = maxH > 0 ? (d.h / maxH) * 100 : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
                color: d.current ? accent : color.text3 }}>{d.h.toFixed(1)}h</span>
              <div style={{ width: '100%', borderRadius: '3px 3px 0 0',
                height: `${pct}%`, minHeight: 3,
                background: d.current ? accent : hexA(accent, 0.35),
                border: d.current ? `1px solid ${hexA(accent, 0.8)}` : 'none' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
              color: d.current ? accent : color.text3 }}>{d.w}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fitness Age Trend Line (30d) ───────────────────────────────────────────
function FitnessAgeLine({ data, accent }) {
  const { color } = BACTA;
  const W = 310, H = 54;
  const pL = 4, pR = 4, pT = 6, pB = 6;
  const iw = W - pL - pR, ih = H - pT - pB;
  const lo = Math.min(...data) - 0.3, hi = Math.max(...data) + 0.3;
  const range = hi - lo || 1;
  const n = data.length;
  const px = i => pL + (i / (n - 1)) * iw;
  const py = v => pT + ih - ((v - lo) / range) * ih;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const area = `${line} L${px(n-1).toFixed(1)},${pT+ih} L${pL},${pT+ih} Z`;
  const gid = 'fage_g';
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(0).toFixed(1)} cy={py(data[0]).toFixed(1)} r="3"
        fill={hexA(accent, 0.5)} />
      <circle cx={px(n-1).toFixed(1)} cy={py(data[n-1]).toFixed(1)} r="4"
        fill={accent} />
    </svg>
  );
}

// ── Sleep Architecture Score Badge ─────────────────────────────────────────
function SleepArchBadge({ score }) {
  const { color } = BACTA;
  const accent = BACTA.section.sleep.accent;
  const c = score >= 88 ? color.green : score >= 75 ? accent : color.amber;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 5,
      background: hexA(c, 0.11), border: `1px solid ${hexA(c, 0.38)}` }}>
      <StatusCore accent={c} size={5} />
      <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, fontWeight: 700,
        letterSpacing: '0.08em', color: c }}>ARCH SCORE {score}</span>
    </div>
  );
}

// ── Sleep Consistency Card ─────────────────────────────────────────────────
function SleepConsistencyCard({ data, accent }) {
  const { color } = BACTA;
  const { bedtimes, labels, stdDev, status, statusColor, avgLabel } = data;
  const lo = Math.min(...bedtimes) - 10, hi = Math.max(...bedtimes) + 10;
  const range = hi - lo || 1;
  const fmt = mins => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };
  const W = 310, H = 52;
  const pL = 6, pR = 6, pT = 12, pB = 4;
  const iw = W - pL - pR, ih = H - pT - pB;
  const n = bedtimes.length;
  const px = i => pL + (i / (n - 1)) * iw;
  const py = v => pT + ((v - lo) / range) * ih; // later = lower (inverted)
  const line = bedtimes.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const avgY = py(bedtimes.reduce((s, v) => s + v, 0) / n);
  return (
    <div style={{ position: 'relative', background: color.surface,
      border: `1px solid ${color.line}`, borderRadius: 10,
      padding: '12px 13px 11px', overflow: 'hidden', marginBottom: 9 }}>
      <Bracket color={accent} inset={6} op={0.28} />
      <div style={{ display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em',
          color: color.text2, fontWeight: 600 }}>SLEEP CONSISTENCY · 7 NIGHTS</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 4,
          background: hexA(statusColor, 0.11), border: `1px solid ${hexA(statusColor, 0.38)}` }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, fontWeight: 700,
            color: statusColor }}>{status}</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
            color: hexA(statusColor, 0.85) }}>±{stdDev}m</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginBottom: 4 }}>
        <line x1={pL} y1={avgY.toFixed(1)} x2={W - pR} y2={avgY.toFixed(1)}
          stroke={hexA(accent, 0.28)} strokeWidth="1" strokeDasharray="3,4" />
        <path d={line} fill="none" stroke={accent} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
        {bedtimes.map((v, i) => (
          <g key={i}>
            <circle cx={px(i).toFixed(1)} cy={py(v).toFixed(1)} r="3.5"
              fill={accent} opacity="0.9" />
            <text x={px(i)} y={py(v) - 6} textAnchor="middle"
              fontSize="6.5" fill={hexA(color.text3, 0.8)} fontFamily={BACTA.FONT_MONO}>
              {fmt(v)}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        paddingLeft: pL, paddingRight: pR }}>
        {labels.map((l, i) => (
          <span key={i} style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
            color: color.text3 }}>{l}</span>
        ))}
      </div>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3, marginTop: 6 }}>
        avg {avgLabel} · target 22:30
      </div>
    </div>
  );
}

// ── Training Effect Bars ──────────────────────────────────────────────────
function TrainingEffectBars({ aerobic, anaerobic, accent }) {
  const { color } = BACTA;
  const aerLabel = aerobic >= 4 ? 'Highly Improving'
    : aerobic >= 3 ? 'Improving' : aerobic >= 2 ? 'Maintaining' : 'Minor Effect';
  const aneLabel = anaerobic >= 4 ? 'Highly Improving'
    : anaerobic >= 3 ? 'Improving' : anaerobic >= 2 ? 'Maintaining' : 'Minor Effect';

  const EffBar = ({ val, label, barColor, sublabel }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.08em',
          color: color.text3 }}>{label}</span>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, fontWeight: 700,
          color: barColor }}>{val.toFixed(1)}<span style={{ color: color.text3, fontWeight: 400 }}>/5</span></span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: hexA(color.text3, 0.1), overflow: 'hidden' }}>
        <div style={{ width: `${(val / 5) * 100}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, ${hexA(barColor, 0.45)}, ${barColor})` }} />
      </div>
      <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
        color: hexA(barColor, 0.75), display: 'block', marginTop: 2 }}>{sublabel}</span>
    </div>
  );

  return (
    <div>
      <EffBar val={aerobic} label="AEROBIC" barColor={accent} sublabel={aerLabel} />
      <EffBar val={anaerobic} label="ANAEROBIC" barColor={BACTA.color.red} sublabel={aneLabel} />
    </div>
  );
}

// ── Run Dynamics Grid ─────────────────────────────────────────────────────
function RunDynamicsGrid({ dyn, accent }) {
  const { color } = BACTA;
  const stats = [
    { label: 'CADENCE',  val: dyn.cadence,           unit: 'spm',  ideal: '170–185' },
    { label: 'STRIDE',   val: dyn.strideLength,       unit: 'cm',   ideal: '100–130' },
    { label: 'VERT OSC', val: dyn.vertOscillation,    unit: 'cm',   ideal: '6–10' },
    { label: 'GCT',      val: dyn.groundContact,      unit: 'ms',   ideal: '<250' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: hexA(accent, 0.05),
          border: `1px solid ${hexA(accent, 0.18)}`, borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, letterSpacing: '0.1em',
            color: color.text3, marginBottom: 2 }}>{s.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 18, fontWeight: 700,
              color: accent, lineHeight: 1 }}>{s.val}</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{s.unit}</span>
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7, color: hexA(color.text3, 0.7),
            marginTop: 1 }}>ideal {s.ideal}</div>
        </div>
      ))}
    </div>
  );
}

// ── Activity Zone Bar (mini, inside expand) ────────────────────────────────
function ActivityZoneBar({ zones }) {
  const { color } = BACTA;
  const zc = ['#56657a', '#4ade80', '#fbbf24', '#f87171', '#ef4444'];
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 1.5, marginBottom: 5 }}>
        {zones.filter(z => z.pct > 0).map(z => (
          <div key={z.zone} style={{ width: `${z.pct}%`, background: zc[z.zone - 1],
            borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {z.pct >= 18 && (
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 6.5,
                fontWeight: 700, color: '#0b0d12' }}>{z.pct}%</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
        {zones.filter(z => z.pct > 0).map(z => (
          <span key={z.zone} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: zc[z.zone - 1], flexShrink: 0 }} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>
              Z{z.zone} {z.pct}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Activity Glyph (local, for LogEntryV3) ────────────────────────────────
function ActivityGlyphV3({ sigil, color: c, size = 16 }) {
  const p = { fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {sigil === 'run' && <g {...p}>
        <circle cx="15.5" cy="5" r="1.8" /><path d="M14 9.5 L10 12 L12.5 14.5 L11 20" />
        <path d="M14 9.5 L17.5 11.5 L20 10" /><path d="M12.5 14.5 L16 16 L18 21" />
        <path d="M10 12 L6 11.5" /></g>}
      {sigil === 'strength' && <g {...p}>
        <line x1="4" y1="9" x2="4" y2="15" /><line x1="20" y1="9" x2="20" y2="15" />
        <line x1="7" y1="7" x2="7" y2="17" /><line x1="17" y1="7" x2="17" y2="17" />
        <line x1="7" y1="12" x2="17" y2="12" /></g>}
      {sigil === 'walk' && <g {...p}>
        <circle cx="12" cy="5" r="1.8" /><path d="M12 7.5 L10 13 L7 16" />
        <path d="M12 7.5 L14 11 L17 10" /><path d="M10 13 L9 19" />
        <path d="M10 13 L13 16 L14 20" /></g>}
      {sigil === 'cycle' && <g {...p}>
        <circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" />
        <path d="M6 16 L12 7 L18 16" /><path d="M12 7 L14 4" />
        <circle cx="14" cy="3.5" r="1" fill={c} stroke="none" /></g>}
    </svg>
  );
}

// ── LogEntryV3 — Expandable ────────────────────────────────────────────────
function LogEntryV3({ a, accent }) {
  const [open, setOpen] = useStateLEV3(false);
  const { color } = BACTA;
  const sigilC = { run: accent, strength: '#fb923c', walk: '#4ade80', cycle: '#fbbf24' };
  const sc = sigilC[a.sigil] || accent;
  const isRun = a.sigil === 'run';
  const stats = [a.dist, a.dur, a.kcal ? `${a.kcal} kcal` : null, a.hr ? `${a.hr} bpm` : null].filter(Boolean);

  return (
    <div style={{ background: color.surface,
      border: `1px solid ${open ? hexA(accent, 0.4) : color.line}`,
      borderRadius: 9, overflow: 'hidden',
      transition: 'border-color 0.18s ease' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex',
        alignItems: 'center', gap: 10, padding: '10px 12px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left', font: 'inherit', color: 'inherit' }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 12, color: accent, flexShrink: 0,
          display: 'block', transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.18s ease', lineHeight: 1 }}>›</span>
        <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hexA(sc, 0.13), border: `1px solid ${hexA(sc, 0.3)}` }}>
          <ActivityGlyphV3 sigil={a.sigil} color={sc} size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: BACTA.FONT_UI, fontSize: 13.5, fontWeight: 650,
            color: color.text, display: 'block' }}>{a.type}</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text2,
            display: 'block', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis' }}>{stats.join('  ·  ')}</span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3,
            display: 'block', letterSpacing: '0.04em' }}>{a.when}</span>
          {a.benefit && (
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, fontWeight: 700,
              color: accent, display: 'block', marginTop: 2 }}>{a.benefit}</span>
          )}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${hexA(accent, 0.2)}`,
          padding: '12px 13px 13px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {a.trainingEffect && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5,
                  letterSpacing: '0.1em', color: color.text2, fontWeight: 600 }}>TRAINING EFFECT</span>
                {a.recoveryTime != null && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 4,
                    background: hexA(color.amber, 0.1), border: `1px solid ${hexA(color.amber, 0.32)}` }}>
                    <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.amber }}>
                      REC TIME {a.recoveryTime}H
                    </span>
                  </div>
                )}
              </div>
              <TrainingEffectBars aerobic={a.trainingEffect.aerobic}
                anaerobic={a.trainingEffect.anaerobic} accent={accent} />
            </div>
          )}

          {a.activityHrZones && (
            <div>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
                color: color.text2, fontWeight: 600, display: 'block', marginBottom: 7 }}>HR ZONES</span>
              <ActivityZoneBar zones={a.activityHrZones} />
            </div>
          )}

          {isRun && a.runDynamics && (
            <div>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
                color: color.text2, fontWeight: 600, display: 'block', marginBottom: 7 }}>RUNNING DYNAMICS</span>
              <RunDynamicsGrid dyn={a.runDynamics} accent={accent} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// StageSplit v3 — lower threshold so Deep (17%) shows its percentage too
function StageSplitV3({ stages }) {
  const { color } = BACTA;
  const total = stages.reduce((a, s) => a + s.mins, 0);
  return (
    <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
      {stages.map(s => (
        <div key={s.key} style={{ width: `${(s.mins / total) * 100}%`, background: s.color,
          opacity: s.key === 'awake' ? 0.45 : 1, borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.pct >= 10 && s.key !== 'awake' && (
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, fontWeight: 700,
              color: '#0b0d12' }}>{s.pct}%</span>
          )}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  BodyBatteryArc, HRVDirectionBadge, LoadRatioRow,
  WeeklyVolumeBars, FitnessAgeLine,
  SleepArchBadge, SleepConsistencyCard,
  TrainingEffectBars, RunDynamicsGrid, ActivityZoneBar,
  ActivityGlyphV3, LogEntryV3,
  StageSplitV3,
});

// ── Patch HealthStatusTile + MetricRingTile to stretch inside InfoCard ─────
const _HSTBase = window.HealthStatusTile;
window.HealthStatusTile = function HealthStatusTile(props) {
  const el = _HSTBase(props);
  return React.cloneElement(el, { style: { ...el.props.style, flex: 1 } });
};

// ── Patch MetricRingTile — add accent top bar + flex stretch ──────────────
const _MRTBase = window.MetricRingTile;
window.MetricRingTile = function MetricRingTile({ accent, ...props }) {
  const ac = accent || BACTA.home.accent;
  const el = _MRTBase({ accent, ...props });
  // Inject accent top-bar span as first child into the existing root element
  const children = [
    React.createElement('span', {
      key: '__accent',
      style: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${ac}, transparent 80%)`,
        opacity: 0.7, pointerEvents: 'none',
      }
    }),
    ...(Array.isArray(el.props.children) ? el.props.children : [el.props.children]),
  ];
  return React.cloneElement(el, { style: { ...el.props.style, flex: 1 } }, ...children);
};
