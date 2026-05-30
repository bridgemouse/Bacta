/* bacta-colors.jsx — MX-4 signature color studies (all within brand palette) */

const MX4_COLORS = [
  { id: 'bacta',   name: 'Bacta Cyan',    hex: '#2bc4e8', note: '★ the healing-fluid glow · the name made literal' },
  { id: 'aurora',  name: 'Aurora Green',  hex: '#4ade80', note: 'current · but shares the "healthy" green' },
  { id: 'signal',  name: 'Signal Violet', hex: '#a78bfa', note: 'premium AI · echoes Sleep accent' },
  { id: 'plasma',  name: 'Plasma Amber',  hex: '#fbbf24', note: 'warm companion · echoes Daily Log' },
];

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

function MiniTransmission({ accent }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', width: 360, borderRadius: 12, overflow: 'hidden',
      background: `linear-gradient(160deg, ${hexA(accent,0.10)}, ${color.surface} 50%)`,
      border: `1px solid ${hexA(accent,0.35)}`, boxShadow: `0 0 22px ${hexA(accent,0.10)}` }}>
      <Bracket color={accent} size={13} inset={8} op={0.75} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 0' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}` }} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.16em', color: accent, fontWeight: 600 }}>INCOMING // MX-4</span>
        <span style={{ marginLeft: 'auto', fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>06:00</span>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 12, padding: '12px 14px 8px', alignItems: 'flex-start' }}>
        <MX4Sigil color={accent} size={44} spin glow mood="transmit" />
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb', fontWeight: 450, letterSpacing: '-0.005em', textWrap: 'pretty', flex: 1 }}>
          Recovery is solid and trending up. Protein is the only gap worth closing tonight.
        </p>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px 12px', borderTop: `1px solid ${hexA(accent,0.16)}` }}>
        {[['TONE','POSITIVE'],['SYNC','OK']].map(([k,v]) => (
          <span key={k} style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.08em', color: color.text3, border: `1px solid ${color.line}`, borderRadius: 4, padding: '3px 7px' }}>
            {k} <span style={{ color: accent }}>{v}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 11 }}>
          {[0,1,2,3,4].map(i => <span key={i} style={{ width: 2, height: 11, background: accent, borderRadius: 1, transformOrigin: 'bottom', animation: `mx4tele 1.${3+i}s ease-in-out ${i*0.12}s infinite`, opacity: 0.85 }} />)}
        </span>
      </div>
    </div>
  );
}

function ColorStudies() {
  const { color } = BACTA;
  return (
    <div style={{ width: 820, background: color.base, borderRadius: 16, padding: 24, fontFamily: BACTA.FONT_UI, border: `1px solid ${color.border}` }}>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, letterSpacing: '0.2em', color: color.text3, marginBottom: 18 }}>MX-4 · SIGNATURE COLOR STUDIES</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {MX4_COLORS.map(c => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 13, height: 13, borderRadius: '50%', background: c.hex, boxShadow: `0 0 8px ${hexA(c.hex,0.6)}` }} />
              <span style={{ fontSize: 13.5, fontWeight: 650, color: color.text, whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{c.hex}</span>
            </div>
            <MiniTransmission accent={c.hex} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.04em', color: color.text3, paddingLeft: 2 }}>{c.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ColorStudies = ColorStudies;
window.MiniTransmission = MiniTransmission;
window.MX4_COLORS = MX4_COLORS;

/* System palette — MX-4 identity, connection states, section channels */
function SystemPalette() {
  const { color, section } = BACTA;
  const Sw = ({ hex, name, sub }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: hex, boxShadow: `0 0 10px ${hexA(hex,0.5)}`, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: color.text, whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3, whiteSpace: 'nowrap' }}>{sub}</span>
      </div>
    </div>
  );
  return (
    <div style={{ width: 470, background: color.base, borderRadius: 16, padding: 24, fontFamily: BACTA.FONT_UI, border: `1px solid ${color.border}` }}>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, letterSpacing: '0.2em', color: color.text3, marginBottom: 16 }}>SYSTEM PALETTE</div>

      {/* identity + connection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 8 }}>
        <Sw hex={BACTA.mx4Color} name="MX-4 · Bacta Cyan" sub="#2bc4e8 · identity" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color.green, boxShadow: `0 0 6px ${color.green}` }} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: color.green, fontWeight: 600, letterSpacing: '0.06em' }}>MX-4 ONLINE</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color.red, boxShadow: `0 0 6px ${color.red}` }} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: color.red, fontWeight: 600, letterSpacing: '0.06em' }}>MX-4 OFFLINE</span>
          </span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3, letterSpacing: '0.04em' }}>connection to AI backend</span>
        </div>
      </div>

      <div style={{ height: 1, background: color.line, margin: '16px 0' }} />
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.16em', color: color.text3, marginBottom: 13 }}>SECTION CHANNELS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {Object.entries(section).map(([k, s]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hexA(s.accent, 0.14), border: `1px solid ${hexA(s.accent,0.4)}`, flexShrink: 0 }}>
              <Sigil name={k} color={s.accent} size={15} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: color.text, whiteSpace: 'nowrap' }}>{s.label}</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>{s.accent}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.SystemPalette = SystemPalette;

/* MX-4 in context — he wears the channel he's operating in; core shifts by tone */
function ContextStudy() {
  const { color, section } = BACTA;
  const contexts = [
    { label: 'Home', sub: 'system-wide', hex: BACTA.mx4Color, mood: 'transmit' },
    ...Object.entries(section).map(([k, s]) => ({ label: s.label, sub: 'in section', hex: s.accent, mood: 'transmit' })),
  ];
  const tonal = [
    { label: 'Positive', sub: 'pleased', hex: color.green, mood: 'pleased' },
    { label: 'Caution', sub: 'alert', hex: color.amber, mood: 'alert' },
    { label: 'Flag', sub: 'alert', hex: color.red, mood: 'alert' },
  ];
  const Cell = ({ hex, label, sub, mood }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: color.surface, border: `1px solid ${hexA(hex,0.3)}`, borderRadius: 11, padding: '15px 8px 11px' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, borderRadius: '50%', background: `radial-gradient(circle, ${hexA(hex,0.14)}, transparent 72%)` }}>
        <MX4Sigil color={hex} size={38} spin glow mood={mood} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 650, color: color.text }}>{label}</span>
      <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.06em', color: color.text3 }}>{sub}</span>
    </div>
  );
  return (
    <div style={{ width: 700, background: color.base, borderRadius: 16, padding: 24, fontFamily: BACTA.FONT_UI, border: `1px solid ${color.border}` }}>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, letterSpacing: '0.2em', color: color.text3, marginBottom: 6 }}>MX-4 · CONTEXTUAL COLOR</div>
      <div style={{ fontSize: 13, color: color.text2, marginBottom: 18, lineHeight: 1.4, textWrap: 'pretty' }}>One identity, dressed for the room. He's bacta-cyan system-wide, wears the channel's color inside a section, and his core shifts by tone.</div>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.16em', color: color.text3, marginBottom: 12 }}>BY CONTEXT</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 9, marginBottom: 22 }}>
        {contexts.map(c => <Cell key={c.label} {...c} />)}
      </div>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.16em', color: color.text3, marginBottom: 12 }}>BY TONE</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 9 }}>
        {tonal.map(c => <Cell key={c.label} {...c} />)}
      </div>
    </div>
  );
}
window.ContextStudy = ContextStudy;
