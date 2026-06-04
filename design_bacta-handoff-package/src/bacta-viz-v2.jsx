/* bacta-viz-v2.jsx — Enhanced visualization primitives for Bacta v2.
   New: HRVBandChart, StageCard, ZoneDistribution, StepBars, ActivityIcon, LogEntryV2
   Load AFTER bacta-viz.jsx. */

/* ── HRV Baseline Band Chart ───────────────────────────────────────────────
   7-day sparkline with shaded personal baseline band + week-avg dashed line.
   The "am I in my normal range?" chart used by Whoop, Garmin Connect, etc. */
function HRVBandChart({ data, baselineLow, baselineHigh, weekAvg, accent }) {
  const { color } = BACTA;
  const W = 310, H = 68;
  const pL = 4, pR = 4, pT = 12, pB = 8;
  const iw = W - pL - pR, ih = H - pT - pB;

  const allVals = [...data, baselineLow - 4, baselineHigh + 5];
  const lo = Math.min(...allVals), hi = Math.max(...allVals);
  const range = hi - lo || 1;

  const px = i => pL + (i / (data.length - 1)) * iw;
  const py = v => pT + ih - ((v - lo) / range) * ih;

  const bandY1 = py(baselineHigh);
  const bandY2 = py(baselineLow);
  const avgY   = py(weekAvg);

  const linePts = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const areaPts = `${linePts} L${px(data.length - 1).toFixed(1)},${H} L${pL},${H} Z`;

  const gid = 'hrv_' + Math.random().toString(36).slice(2, 7);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.22" />
          <stop offset="1" stopColor={accent} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {/* Baseline band */}
      <rect x={pL} y={bandY1.toFixed(1)} width={iw}
        height={(bandY2 - bandY1).toFixed(1)}
        fill={hexA(accent, 0.1)} rx="2" />
      <line x1={pL} y1={bandY1.toFixed(1)} x2={pL + iw} y2={bandY1.toFixed(1)}
        stroke={hexA(accent, 0.35)} strokeWidth="1" strokeDasharray="3,3" />
      <line x1={pL} y1={bandY2.toFixed(1)} x2={pL + iw} y2={bandY2.toFixed(1)}
        stroke={hexA(accent, 0.35)} strokeWidth="1" strokeDasharray="3,3" />
      {/* Week avg line */}
      <line x1={pL} y1={avgY.toFixed(1)} x2={pL + iw} y2={avgY.toFixed(1)}
        stroke={hexA(color.text2, 0.32)} strokeWidth="1" strokeDasharray="2,5" />
      {/* Area fill */}
      <path d={areaPts} fill={`url(#${gid})`} />
      {/* Sparkline */}
      <path d={linePts} fill="none" stroke={accent} strokeWidth="2.1"
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${hexA(accent, 0.5)})` }} />
      {/* Day dots */}
      {data.map((v, i) => {
        const last = i === data.length - 1;
        return (
          <circle key={i}
            cx={px(i).toFixed(1)} cy={py(v).toFixed(1)}
            r={last ? 4.5 : 2.5}
            fill={last ? accent : hexA(accent, 0.55)}
            style={last ? { filter: `drop-shadow(0 0 5px ${accent})` } : {}} />
        );
      })}
    </svg>
  );
}

/* ── Sleep Stage Card ──────────────────────────────────────────────────────
   Shows one stage's duration + % + an ideal-range comparison bar.
   Replaces the stub hypnogram in Sleep Architecture. */
function StageCard({ stage, totalMins }) {
  const { color } = BACTA;
  const hasIdeal = stage.idealMin != null && stage.idealMax != null;
  const inRange  = !hasIdeal || (stage.mins >= stage.idealMin && stage.mins <= stage.idealMax);
  const statusC  = stage.key === 'awake' ? color.text3 : inRange ? color.green : color.amber;
  const pct      = Math.round((stage.mins / totalMins) * 100);

  const fmtM = m =>
    Math.floor(m / 60) > 0
      ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
      : `${m}m`;

  return (
    <div style={{
      position: 'relative', background: BACTA.color.base,
      border: `1px solid ${BACTA.color.line}`,
      borderLeft: `3px solid ${stage.color}`, borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>
          {stage.label}
        </span>
        {stage.key !== 'awake' && (
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: statusC, fontWeight: 700, letterSpacing: '0.04em' }}>
            {inRange ? '◆' : '◈'} {pct}%
          </span>
        )}
        {stage.key === 'awake' && (
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>{pct}%</span>
        )}
      </div>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 16, fontWeight: 700,
        color: color.text, lineHeight: 1, marginBottom: hasIdeal ? 9 : 0 }}>
        {fmtM(stage.mins)}
      </div>
      {hasIdeal && (
        <div>
          <div style={{ position: 'relative', width: '100%', height: 5, borderRadius: 3,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(stage.idealMin / totalMins) * 100}%`,
              width: `${((stage.idealMax - stage.idealMin) / totalMins) * 100}%`,
              background: hexA(stage.color, 0.28), borderRadius: 3,
            }} />
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${Math.min((stage.mins / totalMins) * 100, 100)}%`,
              background: stage.color, borderRadius: 3,
            }} />
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7, color: color.text3, marginTop: 4 }}>
            IDEAL {fmtM(stage.idealMin)}–{fmtM(stage.idealMax)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Zone Distribution ─────────────────────────────────────────────────────
   HR zones: stacked bar + labeled rows with mini bars.
   Replaces the flat zone bar with full context. */
function ZoneDistribution({ zones, accent }) {
  const { color } = BACTA;
  const totalMins = zones.reduce((s, z) => s + z.mins, 0);
  if (totalMins === 0) return null;

  return (
    <div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 13 }}>
        {zones.filter(z => z.mins > 0).map(z => {
          const pct = (z.mins / totalMins) * 100;
          return (
            <div key={z.zone} style={{
              width: `${pct}%`, background: z.color, borderRadius: 3, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {pct >= 13 && (
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, fontWeight: 700, color: '#0b0d12' }}>
                  Z{z.zone}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Zone rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {zones.map(z => {
          const pct    = totalMins > 0 ? Math.round((z.mins / totalMins) * 100) : 0;
          const active = z.mins > 0;
          return (
            <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: z.color,
                flexShrink: 0, opacity: active ? 1 : 0.25 }} />
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3,
                minWidth: 16, flexShrink: 0 }}>Z{z.zone}</span>
              <span style={{ fontFamily: BACTA.FONT_UI, fontSize: 11.5, color: color.text2, flex: 1, minWidth: 0 }}>
                {z.label}
              </span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, fontWeight: active ? 700 : 400,
                color: active ? color.text : color.text3, minWidth: 34, textAlign: 'right', flexShrink: 0 }}>
                {active ? z.mins.toFixed(1) + 'm' : '—'}
              </span>
              <div style={{ width: 48, height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: z.color, borderRadius: 2,
                  opacity: active ? 1 : 0.15 }} />
              </div>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: active ? color.text3 : 'transparent',
                minWidth: 26, textAlign: 'right', flexShrink: 0 }}>
                {active ? pct + '%' : ''}
              </span>
            </div>
          );
        })}
      </div>
      {/* Summary line */}
      <div style={{ marginTop: 10, display: 'flex', gap: 14 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>
          TOTAL <span style={{ color: color.text2, fontWeight: 600 }}>{totalMins.toFixed(0)} min</span>
        </span>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>
          Z2+ <span style={{ color: accent, fontWeight: 600 }}>
            {zones.filter(z => z.zone >= 2).reduce((s, z) => s + z.mins, 0).toFixed(1)} min
          </span>
        </span>
      </div>
    </div>
  );
}

/* ── Step Bars ─────────────────────────────────────────────────────────────
   7-day bar chart for steps with goal line. Bars that meet goal are green. */
function StepBars({ data, goal, accent, labels }) {
  const { color } = BACTA;
  const lbs = labels || BACTA.day;
  const h   = 68;
  const max = Math.max(...data, goal) * 1.12 || 1;
  const goalPct = (goal / max) * 100;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 5, height: h }}>
        {/* Goal line */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: `${goalPct}%`,
          borderTop: `1px dashed ${hexA(color.text2, 0.45)}`,
          zIndex: 2, pointerEvents: 'none',
        }} />
        {data.map((v, i) => {
          const last  = i === data.length - 1;
          const met   = v >= goal;
          const hp    = (v / max) * 100;
          const barC  = last
            ? (met ? color.green : accent)
            : hexA(accent, met ? 0.45 : 0.26);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3 }}>
              <span style={{
                fontFamily: BACTA.FONT_MONO, fontSize: 7, fontWeight: 700, lineHeight: 1,
                color: last ? (met ? color.green : accent) : 'transparent',
              }}>
                {last ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : '·'}
              </span>
              <div style={{
                width: '100%', height: `${Math.max(hp, 3)}%`,
                borderRadius: '3px 3px 2px 2px', background: barC,
                boxShadow: last ? `0 0 8px ${hexA(accent, 0.5)}` : 'none',
                transition: 'height .8s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
          );
        })}
      </div>
      {/* Day labels */}
      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
        {lbs.map((l, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center',
            fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
            color: i === lbs.length - 1 ? accent : color.text3,
            fontWeight: i === lbs.length - 1 ? 700 : 400 }}>{l}</span>
        ))}
      </div>
      {/* Goal legend */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
        <span style={{ display: 'inline-block', width: 16,
          borderTop: `1px dashed ${hexA(color.text2, 0.45)}` }} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3 }}>
          GOAL {(goal / 1000).toFixed(0)}K STEPS
        </span>
      </div>
    </div>
  );
}

/* ── Activity Type Icon ────────────────────────────────────────────────────
   SVG icons mapped from Garmin type_key values. */
function ActivityIcon({ typeKey, color: c, size }) {
  const col = c || '#fff';
  const sz  = size || 18;
  const p   = { fill: 'none', stroke: col, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

  const icons = {
    treadmill_running: (
      <g {...p}>
        <circle cx="15" cy="5.5" r="1.7" fill={col} stroke="none" />
        <path d="M13 9 L9.5 12 L11.5 15 L10 20.5" />
        <path d="M13 9 L16.5 11 L19 10" />
        <path d="M11.5 15 L15 16.5 L17 21" />
        <path d="M9.5 12 L6 11.5" />
        <line x1="3.5" y1="16.5" x2="7.5" y2="16.5" />
        <line x1="4.5" y1="19" x2="7" y2="19" />
      </g>
    ),
    trail_running: (
      <g {...p}>
        <circle cx="15" cy="5.5" r="1.7" fill={col} stroke="none" />
        <path d="M13 9 L9.5 12 L11.5 15 L10 20.5" />
        <path d="M13 9 L16.5 11 L19 10" />
        <path d="M11.5 15 L15 16.5 L17 21" />
        <path d="M3 14.5 L5.5 12 L8 14.5 L10.5 12" />
      </g>
    ),
    strength_training: (
      <g {...p}>
        <line x1="5" y1="9" x2="5" y2="15" />
        <line x1="19" y1="9" x2="19" y2="15" />
        <line x1="8" y1="7" x2="8" y2="17" />
        <line x1="16" y1="7" x2="16" y2="17" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </g>
    ),
    yoga: (
      <g {...p}>
        <circle cx="12" cy="4.5" r="1.7" />
        <path d="M12 7 L12 13" />
        <path d="M12 13 L6.5 17" />
        <path d="M12 13 L17.5 17" />
        <path d="M8 19.5 L12 16.5 L16 19.5" />
      </g>
    ),
    mobility: (
      <g {...p}>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 4.5 L12 6.5" />
        <path d="M12 17.5 L12 19.5" />
        <path d="M4.5 12 L6.5 12" />
        <path d="M17.5 12 L19.5 12" />
        <path d="M6.9 6.9 L8.3 8.3" />
        <path d="M15.7 15.7 L17.1 17.1" />
        <path d="M6.9 17.1 L8.3 15.7" />
        <path d="M15.7 8.3 L17.1 6.9" />
      </g>
    ),
    walking: (
      <g {...p}>
        <circle cx="14" cy="5" r="1.7" fill={col} stroke="none" />
        <path d="M13 8 L10.5 13 L7.5 16" />
        <path d="M13 8 L15.5 12 L18 11" />
        <path d="M10.5 13 L11.5 19.5" />
        <path d="M10.5 13 L9 19" />
      </g>
    ),
    multi_sport: (
      <g {...p}>
        <circle cx="12" cy="6.5" r="2.2" />
        <path d="M7.5 12 A4.5 4.5 0 0 1 16.5 12" />
        <path d="M7.5 12 L5 19" />
        <path d="M16.5 12 L19 19" />
        <line x1="9.5" y1="19" x2="14.5" y2="19" />
      </g>
    ),
  };

  const icon = icons[typeKey] || icons['treadmill_running'];
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
      {icon}
    </svg>
  );
}

/* ── Health Status Tile ────────────────────────────────────────────────────
   Vital metric styled to the section accent. NORMAL/WATCH chip uses
   green/amber for status but the card itself belongs to the section. */
function HealthStatusTile({ label, value, unit, data, inRange, baselineLabel, lowerBetter, sub, accent }) {
  const { color } = BACTA;
  const ok = inRange !== false;
  const statusC = ok ? color.green : color.amber;
  const a = accent || color.text2;

  return (
    <div style={{
      position: 'relative', background: color.surface,
      border: `1px solid ${color.line}`,
      borderLeft: `3px solid ${a}`,
      borderRadius: 8, padding: '10px 11px',
      display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden',
    }}>
      <span style={{
        position: 'absolute', top: 0, left: 3, right: 0, height: 1.5,
        background: `linear-gradient(90deg, ${hexA(a, 0.5)}, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>
          {label}
        </span>
        {/* Status chip — prominent green/amber */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 4,
          background: hexA(statusC, 0.13),
          border: `1px solid ${hexA(statusC, 0.45)}`,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusC,
            boxShadow: `0 0 5px ${statusC}` }} />
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: statusC,
            fontWeight: 700, letterSpacing: '0.06em' }}>
            {ok ? 'NORMAL' : 'WATCH'}
          </span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700,
          color: color.text, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{unit}</span>}
      </div>
      {(baselineLabel || sub) && (
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>
          {sub || baselineLabel}
        </span>
      )}
      {data && data.length > 0 && (
        <Sparkline data={data} accent={a} w={110} h={16} sw={1.4} dot={false} fill={false} />
      )}
    </div>
  );
}

/* ── Metric Ring Tile ──────────────────────────────────────────────────────
   Daily activity metric as mini progress-ring + value + optional goal.
   Much more visual than a plain VitalTile for step/calorie/distance metrics. */
function MetricRingTile({ label, value, unit, goal, accent, data, fmt }) {
  const { color } = BACTA;
  const progress = goal ? Math.min(Number(value) / goal, 1) : 0;
  const met = goal ? Number(value) >= goal : false;
  const ringC = met ? color.green : accent;

  const sz = 46, sw = 4;
  const r = (sz - sw) / 2;
  const C = 2 * Math.PI * r;
  const arc = 0.75;
  const rot = 90 + (1 - arc) * 180;

  const displayVal = fmt ? fmt(value) : (typeof value === 'number' ? value.toLocaleString() : value);

  return (
    <div style={{
      position: 'relative', background: color.surface, border: `1px solid ${color.line}`,
      borderRadius: 8, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden',
    }}>
      {/* Ring gauge */}
      <div style={{ position: 'relative', width: sz, height: sz, flexShrink: 0 }}>
        <svg width={sz} height={sz} style={{ display: 'block' }}>
          <g transform={`rotate(${rot} ${sz/2} ${sz/2})`}>
            <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)"
              strokeWidth={sw} strokeDasharray={`${arc * C} ${C}`} strokeLinecap="round" />
            <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={ringC} strokeWidth={sw}
              strokeDasharray={`${arc * progress * C} ${C}`} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${hexA(ringC, 0.5)})`,
                transition: 'stroke-dasharray .8s cubic-bezier(.4,0,.2,1)' }} />
          </g>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center' }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, fontWeight: 700, color: ringC }}>
            {goal ? Math.round(progress * 100) + '%' : '—'}
          </span>
        </div>
      </div>

      {/* Value + label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: color.text3, fontWeight: 600, marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 17, fontWeight: 700,
            color: color.text, lineHeight: 1 }}>{displayVal}</span>
          {unit && <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>{unit}</span>}
        </div>
        {goal && (
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginTop: 2, whiteSpace: 'nowrap' }}>
            /{typeof goal === 'number' ? (goal >= 1000 ? (goal/1000).toFixed(0)+'k' : goal) : goal} goal
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Bars7v2 ───────────────────────────────────────────────────────────────
   Enhanced 7-day bar chart: adds avg reference line + labeled avg/goal/max.
   Gives charts the contextual meaning the plain Bars7 lacked. */
function Bars7v2({ data, accent, labels, h, goal, fmt, showMax }) {
  const { color } = BACTA;
  const lbs = labels || BACTA.day;
  const barH = h || 70;
  const max = Math.max(...data, goal || 0) * 1.12 || 1;
  const avg = data.reduce((s, v) => s + v, 0) / data.length;
  const goalPct = goal ? (goal / max) * 100 : null;
  const avgPct  = (avg / max) * 100;
  const fmtV = fmt || (v => v >= 10000 ? (v / 1000).toFixed(1) + 'k' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v));

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 5, height: barH }}>
        {/* Avg reference line */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: `${avgPct}%`,
          borderTop: `1px dashed ${hexA(color.text2, 0.28)}`, zIndex: 2, pointerEvents: 'none',
        }} />
        {/* Goal line */}
        {goalPct && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: `${goalPct}%`,
            borderTop: `1px dashed ${hexA(color.text2, 0.5)}`, zIndex: 2, pointerEvents: 'none',
          }} />
        )}
        {data.map((v, i) => {
          const last = i === data.length - 1;
          const hp = (v / max) * 100;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, fontWeight: 600,
                color: last ? accent : 'transparent', lineHeight: 1 }}>
                {last ? fmtV(v) : '·'}
              </span>
              <div style={{
                width: '100%', height: `${Math.max(hp, 3)}%`, borderRadius: '3px 3px 2px 2px',
                background: last ? accent : hexA(accent, 0.28),
                boxShadow: last ? `0 0 8px ${hexA(accent, 0.5)}` : 'none',
                transition: 'height .8s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
        {lbs.map((l, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontFamily: BACTA.FONT_MONO,
            fontSize: 7.5, color: i === lbs.length - 1 ? accent : color.text3,
            fontWeight: i === lbs.length - 1 ? 700 : 400 }}>{l}</span>
        ))}
      </div>

      {/* Reference labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 12, borderTop: `1px dashed ${hexA(color.text2, 0.3)}` }} />
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>
            AVG {fmtV(avg)}
          </span>
        </span>
        {goalPct && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 12, borderTop: `1px dashed ${hexA(color.text2, 0.5)}` }} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>
              GOAL {fmtV(goal)}
            </span>
          </span>
        )}
        {showMax && (
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3 }}>
            MAX {fmtV(Math.max(...data))}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Expandable Log Entry v2 ───────────────────────────────────────────────
   Tap to expand: shows aerobic/anaerobic training effect, recovery time,
   and primary benefit. Uses ActivityIcon for proper type icons. */
function LogEntryV2({ a, accent }) {
  const [open, setOpen] = React.useState(false);
  const { color } = BACTA;
  const stats = [a.dist, a.dur, a.kcal && (a.kcal + ' kcal'), a.hr && (a.hr + ' bpm')].filter(Boolean);
  const [day, time] = (a.when || '').split(' · ');

  const teColor = (v) => v >= 4 ? color.amber : v >= 3 ? color.green : color.text2;
  const teLabel = (v) => v >= 4.5 ? 'HIGHLY IMP.' : v >= 3.5 ? 'IMPROVING' : v >= 2.5 ? 'MAINTAINING' : 'MINOR';

  return (
    <div style={{
      background: color.surface, border: `1px solid ${open ? hexA(accent, 0.35) : color.line}`,
      borderRadius: 8, overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      {/* Main row */}
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', textAlign: 'left',
      }}>
        <span style={{
          flexShrink: 0, width: 35, height: 35, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hexA(accent, 0.13), border: `1px solid ${hexA(accent, 0.3)}`,
        }}>
          <ActivityIcon typeKey={a.typeKey} color={accent} size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
            <span style={{ fontFamily: BACTA.FONT_UI, fontSize: 13.5, fontWeight: 650,
              color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {a.type}
            </span>
            {a.feel && (
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: accent,
                letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{a.feel}</span>
            )}
          </div>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: color.text2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.join(' · ')}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: accent, fontWeight: 600 }}>{day}</div>
          {time && <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginTop: 1 }}>{time}</div>}
        </div>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, color: color.text3, flexShrink: 0,
          transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s', marginLeft: 2 }}>
          ›
        </span>
      </button>

      {/* Expanded detail */}
      {open && a.trainingEffect && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${hexA(accent, 0.15)}` }}>
          <div style={{ display: 'flex', gap: 9, marginTop: 10 }}>
            {/* Aerobic TE */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3, marginBottom: 5 }}>AEROBIC EFFECT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 18, fontWeight: 700,
                  color: teColor(a.trainingEffect.aerobic) }}>{a.trainingEffect.aerobic}</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3 }}>/5</span>
              </div>
              <div style={{ marginTop: 5, width: '100%', height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${(a.trainingEffect.aerobic / 5) * 100}%`, height: '100%',
                  background: teColor(a.trainingEffect.aerobic), borderRadius: 2 }} />
              </div>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: teColor(a.trainingEffect.aerobic),
                marginTop: 3, fontWeight: 600 }}>{teLabel(a.trainingEffect.aerobic)}</div>
            </div>
            {/* Anaerobic TE */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3, marginBottom: 5 }}>ANAEROBIC EFFECT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 18, fontWeight: 700,
                  color: teColor(a.trainingEffect.anaerobic) }}>{a.trainingEffect.anaerobic}</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3 }}>/5</span>
              </div>
              <div style={{ marginTop: 5, width: '100%', height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${(a.trainingEffect.anaerobic / 5) * 100}%`, height: '100%',
                  background: teColor(a.trainingEffect.anaerobic), borderRadius: 2 }} />
              </div>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: teColor(a.trainingEffect.anaerobic),
                marginTop: 3, fontWeight: 600 }}>{teLabel(a.trainingEffect.anaerobic)}</div>
            </div>
          </div>

          {/* Recovery time + benefit */}
          <div style={{ display: 'flex', gap: 9, marginTop: 10 }}>
            {a.recoveryTime && (
              <div style={{ flex: 1, background: color.base, border: `1px solid ${color.line}`,
                borderRadius: 6, padding: '7px 9px' }}>
                <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginBottom: 3 }}>
                  RECOVERY TIME
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 15, fontWeight: 700,
                    color: color.text }}>{a.recoveryTime}</span>
                  <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>h</span>
                </div>
              </div>
            )}
            {a.benefit && (
              <div style={{ flex: 1, background: color.base, border: `1px solid ${color.line}`,
                borderRadius: 6, padding: '7px 9px' }}>
                <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginBottom: 3 }}>
                  PRIMARY BENEFIT
                </div>
                <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, fontWeight: 700,
                  color: accent, letterSpacing: '0.05em' }}>{a.benefit}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Enhanced TrendRow — overrides bacta-viz.jsx version ──────────────────
   Sparklines show min/avg/max labels below for context.
   Bar charts use Bars7v2 with reference lines. */
function TrendRow({ label, value, unit, sub, data, accent, delta, lowerBetter, kind, fmt }) {
  const { color } = BACTA;
  if (!data || data.length === 0) return null;
  const nums = data.filter(v => typeof v === 'number' && !isNaN(v));
  const dMin = Math.min(...nums);
  const dMax = Math.max(...nums);
  const dAvg = Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10;
  const fmtV = fmt || (v => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n)) return v;
    return Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : (Math.round(n * 10) / 10);
  });

  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
      background: color.surface, border: `1px solid ${color.line}`,
      borderRadius: 9, padding: '11px 13px', overflow: 'hidden',
    }}>
      <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, background: accent, opacity: 0.7 }} />
      <div style={{ minWidth: 84, flexShrink: 0 }}>
        <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 18, fontWeight: 700,
            color: color.text, lineHeight: 1 }}>{value}</span>
          {unit && <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{unit}</span>}
        </div>
        {(delta !== undefined || sub) && (
          <div style={{ marginTop: 4 }}>
            {delta !== undefined
              ? <Delta value={delta} lowerBetter={lowerBetter} size={9} />
              : <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{sub}</span>}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kind === 'bars' ? (
          <Bars7v2 data={data} accent={accent} h={42} fmt={fmt} />
        ) : (
          <div>
            <Sparkline data={data} accent={accent} w={180} h={38} sw={1.8} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7, color: hexA(color.text2, 0.45) }}>
                {fmtV(dMin)}{unit || ''}
              </span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7, color: hexA(color.text2, 0.45) }}>
                avg {dAvg}{unit || ''}
              </span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7, color: hexA(color.text2, 0.45) }}>
                {fmtV(dMax)}{unit || ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  HRVBandChart, StageCard, ZoneDistribution, StepBars, ActivityIcon,
  HealthStatusTile, MetricRingTile, Bars7v2, TrendRow,
  LogEntryV2,
});
