/* bacta-final.jsx — FINAL "MX-4 OS · System Cards" + reusable building blocks.
   Exports: FTelemetry, SystemCard, TransmissionPanel, BactaStatusBar,
   BactaDock, HomeBody, bactaTexture, FinalScreen. */

const MX4 = '#2bc4e8'; // MX-4 bacta-cyan identity (the healing-fluid glow)

function bactaTexture(accent = MX4) {
  const a = (x) => hexA(accent, x);
  return {
    backgroundImage:
      `repeating-linear-gradient(0deg, rgba(255,255,255,0.016) 0px, rgba(255,255,255,0.016) 1px, transparent 1px, transparent 3px),` +
      `linear-gradient(${a(0.035)} 1px, transparent 1px), linear-gradient(90deg, ${a(0.035)} 1px, transparent 1px)`,
    backgroundSize: '100% 3px, 26px 26px, 26px 26px',
  };
}

function FTelemetry({ color = MX4, bars = 5 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{ width: 2, background: color, borderRadius: 1, transformOrigin: 'bottom',
          height: 12, animation: `mx4tele 1.${3 + i}s ease-in-out ${i * 0.12}s infinite`, opacity: 0.85 }} />
      ))}
    </span>
  );
}

/* System Card — bracket corners, top accent edge, mono numerals */
function SystemCard({ t, idx, onClick }) {
  const { color } = BACTA;
  const accent = BACTA.section[t.key].accent;
  return (
    <button onClick={onClick} style={{ position: 'relative', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: onClick ? 'pointer' : 'default', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 7, padding: '12px 13px 11px', minHeight: 116, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Bracket color={accent} inset={6} op={0.5} />
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.9 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingLeft: 4 }}>
        <Sigil name={t.key} color={accent} size={14} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text2, fontWeight: 600 }}>{BACTA.section[t.key].label}</span>
        <span style={{ marginLeft: 'auto', fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>{String(idx+1).padStart(2,'0')}</span>
      </div>

      {t.viz === 'ring' && (
        <div style={{ position: 'absolute', top: 30, right: 12 }}>
          <Ring progress={t.ring} accent={accent} size={38} stroke={3}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text2, fontWeight: 600 }}>{Math.round(t.ring*100)}</span>
          </Ring>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 4 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 22, fontWeight: 700, color: color.text, lineHeight: 1, letterSpacing: '-0.01em' }}>{t.value}</span>
        {t.unit && <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text3 }}>{t.unit}</span>}
      </div>
      <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text2, marginTop: 5, paddingLeft: 4 }}>{t.sub}</div>

      <div style={{ marginTop: 'auto', paddingTop: 8, paddingLeft: 4 }}>
        {t.viz === 'spark' && <Sparkline data={t.spark} accent={accent} w={140} h={24} sw={1.6} />}
        {t.viz === 'dots' && <ReadinessDots value={t.dots} accent={accent} />}
        {t.viz === 'shield' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5,13 10,18 19,7"/></svg>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: accent, letterSpacing: '0.06em' }}>{t.status.toUpperCase()}</span>
          </div>
        )}
      </div>
    </button>
  );
}

/* Transmission panel — parameterized by accent so MX-4 wears the room */
function TransmissionPanel({ accent = MX4, mood = 'transmit', label = 'INCOMING // MX-4', meta, assessment, chips = [['TONE','POSITIVE'],['FLAGS','0'],['SYNC','OK']] }) {
  const { color } = BACTA;
  const a = (x) => hexA(accent, x);
  return (
    <div style={{ position: 'relative', borderRadius: 14, marginBottom: 14, overflow: 'hidden',
      background: `linear-gradient(160deg, ${a(0.10)}, ${color.surface} 50%)`,
      border: `1px solid ${a(0.35)}`, boxShadow: `0 0 26px ${a(0.10)}, inset 0 0 30px ${a(0.04)}` }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, padding: '11px 15px 0' }}>
        <MX4Sigil color={accent} size={19} spin glow mood={mood} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.16em', color: accent, fontWeight: 600 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{meta}</span>
      </div>
      <div style={{ position: 'relative', padding: '12px 15px 8px' }}>
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.5, color: '#eef4fb', fontWeight: 450, letterSpacing: '-0.005em', textWrap: 'pretty' }}>
          {assessment}<span style={{ display: 'inline-block', width: 7, height: 15, marginLeft: 3, background: accent, verticalAlign: '-2px', animation: 'mx4blink 1.1s step-end infinite' }} />
        </p>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px 13px', borderTop: `1px solid ${a(0.16)}`, marginTop: 4 }}>
        {chips.map(([k, v]) => (
          <span key={k} style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em', color: color.text3, border: `1px solid ${color.line}`, borderRadius: 4, padding: '3px 7px' }}>
            {k} <span style={{ color: accent }}>{v}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}><FTelemetry color={accent} bars={5} /></span>
      </div>
    </div>
  );
}

/* Status bar — home shows BACTA·OS; a section shows back + title in channel color */
function BactaStatusBar({ accent = MX4, title, sectionKey, onBack }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', zIndex: 1, background: 'rgba(17,24,39,0.92)', borderBottom: `1px solid ${hexA(accent,0.28)}`, padding: '50px 15px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: `0 1px 0 ${hexA(accent,0.12)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {onBack ? (
          <>
            <button onClick={onBack} aria-label="Back" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4, display: 'flex' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,5 8,12 15,19"/></svg>
            </button>
            <Sigil name={sectionKey} color={accent} size={16} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', color: accent }}>{title}</span>
          </>
        ) : (
          <>
            <MX4Sigil color={MX4} size={18} spin mood="idle" />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em' }}>BACTA<span style={{ color: color.text3 }}>·OS</span></span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusCore accent={color.green} size={6} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: color.green, fontWeight: 600, letterSpacing: '0.08em' }}>MX-4 ONLINE</span>
      </div>
    </div>
  );
}

/* Command dock — one cohesive MX-4 control deck: Ask MX-4 (his cyan identity) ·
   Overview/Trends pills (channel accent) · hex nav, all housed in a single
   cyan-washed cluster with hairline dividers. Tabs only show on built channels. */
function BactaDock({ accent = MX4, onAsk, onNav, tab, onTab, showTabs }) {
  const { color } = BACTA;
  const divider = <span style={{ width: 1, height: 24, background: hexA(MX4, 0.22), flexShrink: 0 }} />;
  return (
    <div style={{ position: 'relative', zIndex: 1, background: 'rgba(17,24,39,0.92)', borderTop: `1px solid ${hexA(MX4, 0.28)}`, padding: '12px 16px 24px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
      {/* MX-4 command cluster — always his cyan, on every channel */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '5px 7px', borderRadius: 30, background: `linear-gradient(180deg, ${hexA(MX4, 0.07)}, ${color.surface})`, border: `1px solid ${hexA(MX4, 0.3)}`, boxShadow: `0 0 20px ${hexA(MX4, 0.09)}, inset 0 1px 0 rgba(255,255,255,0.04)` }}>
        {/* Ask MX-4 — his identity anchor */}
        <button onClick={onAsk} aria-label="Ask MX-4" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: showTabs ? 0 : 9, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: '50%', background: `radial-gradient(circle, ${hexA(MX4, 0.16)}, ${hexA(MX4, 0.03)} 70%)`, border: `1px solid ${hexA(MX4, 0.55)}`, animation: 'mx4glowbreathe 3.6s ease-in-out infinite', flexShrink: 0 }}>
            <MX4Sigil color={MX4} size={27} glow mood="listen" />
          </span>
          {!showTabs && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingRight: 4 }}>
              <span style={{ fontFamily: BACTA.FONT_UI, fontSize: 13, fontWeight: 650, color: color.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Ask MX-4</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.12em', color: color.text3, whiteSpace: 'nowrap' }}>TAP TO TALK</span>
            </span>
          )}
        </button>

        {divider}

        {showTabs && (
          <>
            <SectionTabs key="mx4" accent={MX4} tab={tab} onTab={onTab} />
            {divider}
          </>
        )}

        <button onClick={onNav} aria-label="All systems" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: '50%', background: `radial-gradient(circle, ${hexA(color.text2, 0.1)}, transparent 70%)`, border: `1px solid ${hexA(color.text2, 0.45)}`, boxShadow: `0 0 11px ${hexA(color.text2, 0.22)}, inset 0 0 7px ${hexA(color.text2, 0.06)}`, cursor: 'pointer', padding: 0 }}>
          <NavIcon color={color.text2} size={24} />
        </button>
      </div>
    </div>
  );
}

/* Home body — transmission + SYSTEMS rail + 6 System Cards */
function HomeBody({ onOpenSection }) {
  const { color, mx4 } = BACTA;
  return (
    <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overscrollBehavior: 'none', padding: '13px 13px 8px' }}>
      <TransmissionPanel accent={MX4} meta={`${mx4.date} · ${mx4.time}`} assessment={mx4.assessment} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.2em', color: MX4 }}>SYSTEMS</span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${hexA(MX4,0.4)}, ${color.line})` }} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>6 ONLINE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {BACTA.tiles.map((t, i) => <SystemCard key={t.key} t={t} idx={i} onClick={onOpenSection ? () => onOpenSection(t.key) : undefined} />)}
      </div>
    </div>
  );
}

/* Static composition for the design canvas */
function FinalScreen() {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.base, fontFamily: BACTA.FONT_UI, color: color.text }}>
      <div style={{ position: 'absolute', inset: 0, ...bactaTexture(MX4), pointerEvents: 'none', zIndex: 0 }} />
      <BactaStatusBar accent={MX4} />
      <HomeBody />
      <BactaDock accent={MX4} />
    </div>
  );
}

Object.assign(window, { MX4, bactaTexture, FTelemetry, SystemCard, TransmissionPanel, BactaStatusBar, BactaDock, HomeBody, FinalScreen });
