/* bacta-core.jsx — shared design system for Bacta Home directions
   Exports to window: BACTA (tokens+data), Sigil, MX4Sigil, Ring, Sparkline,
   StatusCore, ReadinessDots. */

const BACTA = {
  color: {
    base: '#0f1117',
    surface: '#111827',
    elevated: '#1e2d3d',
    border: '#1e2d3d',
    line: '#27384a',
    text: '#f4f7fb',
    text2: '#94a3b8',
    text3: '#56657a',
    green: '#4ade80',
    amber: '#fbbf24',
    red: '#f87171',
  },
  section: {
    // Round-1 canonical channel accents (locked by brief). cyan band stays
    // reserved for MX-4 so nothing competes with his bacta identity.
    recovery:  { label: 'Recovery',   accent: '#64b5f6' }, // sky blue — restoration
    training:  { label: 'Training',   accent: '#fb923c' }, // ember — exertion
    sleep:     { label: 'Sleep',      accent: '#a78bfa' }, // violet — rest
    nutrition: { label: 'Nutrition',  accent: '#3ecf8e' }, // clinical green — fuel / healthy
    bloodwork: { label: 'Blood Work', accent: '#ef6f6c' }, // coral red — labs
    dailylog:  { label: 'Daily Log',  accent: '#f5cf5e' }, // gold — log
  },
  home: { label: 'Home', accent: '#2bc4e8' }, // overview = MX-4's own surface → bacta cyan
  // Home overview tiles — real metrics from the brief
  tiles: [
    { key: 'recovery',  value: '74',    unit: 'battery',   sub: 'HRV \u2191 61ms',          viz: 'spark', spark: [50,54,49,57,55,60,66,74], status: 'Good' },
    { key: 'training',  value: '342',   unit: 'load',      sub: 'Moderate \u00b7 wk 4 / 8',  viz: 'spark', spark: [280,300,260,320,340,310,330,342], status: 'On track' },
    { key: 'sleep',     value: '8.1',   unit: 'h',         sub: 'Score 82',                  viz: 'ring',  ring: 0.82, status: 'Solid' },
    { key: 'nutrition', value: '2,340', unit: 'kcal',      sub: 'Protein 142 / 160g',        viz: 'ring',  ring: 0.94, status: 'On target' },
    { key: 'bloodwork', value: 'Clear', unit: '',          sub: 'No flags \u00b7 0 panels',  viz: 'shield',status: 'Nominal' },
    { key: 'dailylog',  value: '4',     unit: '/ 5',       sub: 'Logged today',              viz: 'dots',  dots: 4,    status: 'Logged' },
  ],
  mx4: {
    assessment: 'Recovery is solid and trending up. Training load is on track for week four. Nutrition is close \u2014 protein is the only gap worth closing tonight.',
    tone: 'positive', // positive | caution | flag
    time: '06:00',
    date: 'MON \u00b7 MAY 29',
  },
};
BACTA.toneColor = (t) => t === 'flag' ? BACTA.color.red : t === 'caution' ? BACTA.color.amber : BACTA.color.green;
BACTA.mx4Color = '#2bc4e8'; // MX-4 signature — bacta healing-fluid cyan

const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";
BACTA.FONT_UI = FONT_UI;
BACTA.FONT_MONO = FONT_MONO;

/* ── Abstract geometric section sigils ─────────────────────────── */
function Sigil({ name, color = '#fff', size = 18, sw = 1.6 }) {
  const p = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const v = { recovery: (
      <g {...p}><circle cx="12" cy="12" r="7.5" strokeDasharray="34 13" transform="rotate(-90 12 12)"/><circle cx="12" cy="12" r="1.7" fill={color} stroke="none"/></g>
    ),
    training: (
      <g {...p}><polyline points="6,13 12,8 18,13"/><polyline points="6,17 12,12 18,17"/></g>
    ),
    sleep: (
      <g {...p}><path d="M16.5 13.2A6 6 0 1 1 10.8 6.5 4.7 4.7 0 0 0 16.5 13.2Z"/></g>
    ),
    nutrition: (
      <g {...p}><polygon points="12,4.5 18.5,8.2 18.5,15.8 12,19.5 5.5,15.8 5.5,8.2"/></g>
    ),
    bloodwork: (
      <g {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" transform="rotate(45 12 12)"/><line x1="8.8" y1="12" x2="15.2" y2="12"/></g>
    ),
    dailylog: (
      <g {...p}><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="15" y2="12"/><line x1="6" y1="16" x2="12" y2="16"/></g>
    ),
  }[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>{v}</svg>;
}

/* ── MX-4 signature aperture sigil — with moods/expressions ─────
   One aperture motif, many states. He's a droid with personality, so
   each placement shows a contextually-true expression:
     transmit · idle · listen · think · alert · pleased            */
function MX4Sigil({ color = '#4ade80', size = 40, spin = false, glow = false, mood = 'transmit' }) {
  const F = <polygon points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14" fill="none" stroke={color} strokeWidth="1.3" strokeOpacity="0.5"/>;
  const Ffaint = <polygon points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14" fill="none" stroke={color} strokeWidth="1.2" strokeOpacity="0.32"/>;
  const core = <circle cx="24" cy="24" r="3.4" fill={color}/>;
  const coreSm = <circle cx="24" cy="24" r="2.6" fill={color}/>;
  const spinStyle = spin ? { transformOrigin: '24px 24px', animation: 'mx4spin 14s linear infinite' } : undefined;
  const spinStyleRev = spin ? { transformOrigin: '24px 24px', animation: 'mx4spin 18s linear infinite reverse' } : undefined;

  let inner;
  switch (mood) {
    case 'idle': // at rest — calm single ring, soft core, quiet side ticks
      inner = (<>
        <circle cx="24" cy="24" r="11" fill="none" stroke={color} strokeWidth="1.3" strokeOpacity="0.5"/>
        <line x1="5.5" y1="24" x2="9" y2="24" stroke={color} strokeWidth="1.3" strokeOpacity="0.4" strokeLinecap="round"/>
        <line x1="39" y1="24" x2="42.5" y2="24" stroke={color} strokeWidth="1.3" strokeOpacity="0.4" strokeLinecap="round"/>
        {coreSm}
        <circle cx="24" cy="24" r="6" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.3"/>
      </>); break;
    case 'listen': // open eye — attentive, receptive (distinct lens shape vs transmit's rings)
      inner = (<>
        {Ffaint}
        <path d="M8.5 24 Q24 13 39.5 24 Q24 35 8.5 24 Z" fill="none" stroke={color} strokeWidth="1.6" strokeOpacity="0.9"/>
        <circle cx="24" cy="24" r="7.5" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.32"/>
        <circle cx="24" cy="24" r="4" fill={color}/>
      </>); break;
    case 'think': // processing — scanning dashes + a swept bar
      inner = (<>
        {F}
        <g style={spinStyleRev}><circle cx="24" cy="24" r="12.5" fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="3 7" strokeLinecap="round" strokeOpacity="0.85"/></g>
        <line x1="15" y1="24" x2="33" y2="24" stroke={color} strokeWidth="1.4" strokeDasharray="2.5 2.5" strokeOpacity="0.8"/>
        <circle cx="24" cy="24" r="2.6" fill={color}/>
      </>); break;
    case 'alert': // heightened — narrowed slit core, tighter ring
      inner = (<>
        {F}
        <circle cx="24" cy="24" r="9.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.85"/>
        <rect x="22.5" y="17.5" width="3" height="13" rx="1.5" fill={color}/>
      </>); break;
    case 'pleased': // content — upward squint arc over the core
      inner = (<>
        {F}
        <circle cx="24" cy="24" r="9.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.8"/>
        <path d="M18.5 26.5 Q24 20.5 29.5 26.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="28.5" r="1.8" fill={color}/>
      </>); break;
    case 'transmit': // speaking — full aperture, the briefing state
    default:
      inner = (<>
        {F}
        <g style={spinStyle}><circle cx="24" cy="24" r="13" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 9" strokeLinecap="round" strokeOpacity="0.9"/></g>
        <circle cx="24" cy="24" r="8.5" fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.85"/>
        {core}
        <circle cx="24" cy="24" r="6" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.4"/>
      </>);
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {glow && <filter id="mx4glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>}
      </defs>
      <g filter={glow ? 'url(#mx4glow)' : undefined}>{inner}</g>
    </svg>
  );
}

/* ── Circular progress ring ────────────────────────────────────── */
function Ring({ progress = 0, accent = '#fff', size = 40, stroke = 4, track, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track || 'rgba(255,255,255,0.09)'} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={accent} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)' }}/>
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>}
    </div>
  );
}

/* ── Sparkline with soft area fill ─────────────────────────────── */
function Sparkline({ data = [], accent = '#fff', w = 92, h = 30, sw = 1.8, fill = true, dot = true }) {
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((d, i) => [ (i / (data.length - 1)) * w, h - 3 - ((d - min) / rng) * (h - 6) ]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const id = 'sg' + Math.random().toString(36).slice(2, 7);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={accent} stopOpacity="0.28"/><stop offset="1" stopColor={accent} stopOpacity="0"/>
      </linearGradient></defs>
      {fill && <path d={area} fill={`url(#${id})`}/>}
      <path d={line} fill="none" stroke={accent} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      {dot && <circle cx={last[0]} cy={last[1]} r={2.4} fill={accent}/>}
    </svg>
  );
}

/* ── Breathing status core ─────────────────────────────────────── */
function StatusCore({ accent = '#4ade80', size = 8, active = true, rings = true }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      {active && rings && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: accent, animation: 'mx4ping 2.6s cubic-bezier(0,0,.2,1) infinite' }}/>}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: accent,
        boxShadow: active ? `0 0 7px ${accent}` : 'none', opacity: active ? 1 : 0.45,
        animation: active ? 'mx4breathe 2.6s ease-in-out infinite' : 'none' }}/>
    </span>
  );
}

/* ── Readiness dots ────────────────────────────────────────────── */
function ReadinessDots({ value = 4, total = 5, accent = '#fbbf24', size = 7 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ width: size, height: size, borderRadius: '50%',
          background: i < value ? accent : 'transparent',
          border: `1.5px solid ${i < value ? accent : 'rgba(255,255,255,0.18)'}`,
          boxShadow: i < value ? `0 0 5px ${accent}66` : 'none' }}/>
      ))}
    </span>
  );
}

/* ── Bracket corner ticks (console framing) ────────────────────── */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function Bracket({ color, size = 11, sw = 1.4, op = 0.55, inset = 7, radius = 4 }) {
  const base = { position: 'absolute', width: size, height: size, pointerEvents: 'none', opacity: op };
  const C = (s) => ({ ...base, ...s });
  return (
    <>
      <span style={C({ top: inset, left: inset, borderTop: `${sw}px solid ${color}`, borderLeft: `${sw}px solid ${color}`, borderTopLeftRadius: radius })} />
      <span style={C({ top: inset, right: inset, borderTop: `${sw}px solid ${color}`, borderRight: `${sw}px solid ${color}`, borderTopRightRadius: radius })} />
      <span style={C({ bottom: inset, left: inset, borderBottom: `${sw}px solid ${color}`, borderLeft: `${sw}px solid ${color}`, borderBottomLeftRadius: radius })} />
      <span style={C({ bottom: inset, right: inset, borderBottom: `${sw}px solid ${color}`, borderRight: `${sw}px solid ${color}`, borderBottomRightRadius: radius })} />
    </>
  );
}

/* ── Nav launcher — hex frame (MX-4's shape) with menu lines, stroked to
   match the section-sigil language ── */
function NavIcon({ color = '#94a3b8', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <polygon points="12,2.8 20.3,7.6 20.3,16.4 12,21.2 3.7,16.4 3.7,7.6" strokeOpacity="0.5" />
      <line x1="8.6" y1="9.6" x2="15.4" y2="9.6" />
      <line x1="8.6" y1="12" x2="15.4" y2="12" />
      <line x1="8.6" y1="14.4" x2="12.8" y2="14.4" />
    </svg>
  );
}

Object.assign(window, { BACTA, Sigil, MX4Sigil, Ring, Sparkline, StatusCore, ReadinessDots, Bracket, NavIcon, hexA });
