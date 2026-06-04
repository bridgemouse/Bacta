/* bacta-navsheet.jsx — the All Systems nav card (focus), Ask MX-4 sheet,
   and a reusable Sheet wrapper with smooth enter/exit. */

const { useState: useStateNS, useEffect: useEffectNS } = React;

/* Bottom-sheet wrapper: dim backdrop + slide-up, animated both ways */
function Sheet({ open, onClose, children, maxHeight = '82%' }) {
  const [render, setRender] = useStateNS(open);
  const [shown, setShown] = useStateNS(false);
  useEffectNS(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    } else {
      setShown(false);
      const t = setTimeout(() => setRender(false), 340);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!render) return null;
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: shown ? 'rgba(6,9,14,0.62)' : 'rgba(6,9,14,0)', transition: 'background .34s ease', backdropFilter: shown ? 'blur(3px)' : 'blur(0px)', WebkitBackdropFilter: shown ? 'blur(3px)' : 'blur(0px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ maxHeight, transform: shown ? 'translateY(0)' : 'translateY(101%)', transition: 'transform .36s cubic-bezier(.22,.61,.36,1)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function SheetShell({ accent, children }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', background: 'rgba(17,24,39,0.97)', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTop: `1px solid ${hexA(accent, 0.4)}`, boxShadow: `0 -18px 50px rgba(0,0,0,0.5), 0 0 40px ${hexA(accent, 0.07)}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%', fontFamily: BACTA.FONT_UI, color: color.text }}>
      <div style={{ position: 'absolute', inset: 0, ...bactaTexture(accent), pointerEvents: 'none', opacity: 0.7 }} />
      {/* grab handle */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: 9 }}>
        <span style={{ width: 38, height: 4, borderRadius: 4, background: hexA(accent, 0.4) }} />
      </div>
      {children}
    </div>
  );
}

function SheetHeader({ accent, sigil, title, sub, onClose }) {
  const { color } = BACTA;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 18px 12px' }}>
      {sigil}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>{title}</span>
        {sub && <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.1em', color: color.text3 }}>{sub}</span>}
      </div>
      <button onClick={onClose} aria-label="Close" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: `1px solid ${color.line}`, background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color.text2} strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
    </div>
  );
}

/* ── ALL SYSTEMS — the nav card ─────────────────────────────────── */
function NavSheet({ open, onClose, current = 'home', onNavigate }) {
  const { color } = BACTA;
  const tileByKey = Object.fromEntries(BACTA.tiles.map(t => [t.key, t]));
  return (
    <Sheet open={open} onClose={onClose} maxHeight="86%">
      <SheetShell accent={MX4}>
        <SheetHeader accent={MX4} title="ALL SYSTEMS" sub="SELECT A CHANNEL"
          sigil={<NavIcon color={MX4} size={26} />} onClose={onClose} />

        <div style={{ position: 'relative', overflowY: 'auto', padding: '2px 16px 0' }}>
          {/* Home / Overview — full-width */}
          <button onClick={() => onNavigate('home')} style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: 12, background: current === 'home' ? hexA(MX4, 0.08) : color.surface, border: `1px solid ${current === 'home' ? hexA(MX4, 0.45) : color.line}`, borderRadius: 12, padding: '13px 14px', marginBottom: 14 }}>
            <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hexA(MX4, 0.12), border: `1px solid ${hexA(MX4, 0.3)}` }}>
              <MX4Sigil color={MX4} size={24} mood="idle" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: color.text }}>Home · Overview</div>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 10, color: color.text2, marginTop: 2 }}>6 systems nominal</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MX4} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,5 16,12 9,19"/></svg>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.18em', color: color.text3 }}>CHANNELS</span>
            <span style={{ flex: 1, height: 1, background: color.line }} />
          </div>

          {/* 6 section channels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4 }}>
            {Object.entries(BACTA.section).map(([key, s]) => {
              const t = tileByKey[key];
              const active = current === key;
              return (
                <button key={key} onClick={() => onNavigate(key)} style={{ position: 'relative', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', background: active ? hexA(s.accent, 0.09) : color.surface, border: `1px solid ${active ? hexA(s.accent, 0.5) : color.line}`, borderRadius: 11, padding: '13px 12px 12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${s.accent}, transparent 80%)`, opacity: 0.9 }} />
                  <Bracket color={s.accent} inset={6} op={0.45} radius={4} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hexA(s.accent, 0.13), border: `1px solid ${hexA(s.accent, 0.32)}` }}>
                      <Sigil name={key} color={s.accent} size={17} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 650, color: color.text, lineHeight: 1.1 }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 15, fontWeight: 700, color: color.text, lineHeight: 1 }}>{t.value}</span>
                    {t.unit && <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>{t.unit}</span>}
                    <span style={{ marginLeft: 'auto', fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: s.accent, letterSpacing: '0.04em' }}>{t.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MX-4 footer line — personality */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px 26px', borderTop: `1px solid ${color.line}`, marginTop: 12 }}>
          <MX4Sigil color={MX4} size={17} spin mood="idle" />
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: color.text2 }}>WHERE TO, COMMANDER?</span>
          <span style={{ marginLeft: 'auto' }}><FTelemetry color={MX4} bars={4} /></span>
        </div>
      </SheetShell>
    </Sheet>
  );
}

/* ── ASK MX-4 — conversation shell ──────────────────────────────── */
function AskSheet({ open, onClose, accent = MX4 }) {
  const { color } = BACTA;
  const prompts = ['How is my recovery trending?', "Plan today's training", 'Why is my HRV up?', 'Summarize my week'];
  return (
    <Sheet open={open} onClose={onClose} maxHeight="88%">
      <SheetShell accent={accent}>
        <SheetHeader accent={accent} title="MX-4" sub="ASK ANYTHING · MEDICAL & PROTOCOL"
          sigil={<MX4Sigil color={accent} size={30} spin glow mood="transmit" />} onClose={onClose} />

        <div style={{ position: 'relative', overflowY: 'auto', padding: '4px 18px 8px' }}>
          {/* MX-4 greeting */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><MX4Sigil color={accent} size={26} mood="pleased" /></span>
            <div style={{ background: hexA(accent, 0.08), border: `1px solid ${hexA(accent, 0.22)}`, borderRadius: '4px 14px 14px 14px', padding: '11px 14px' }}>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#eef4fb', textWrap: 'pretty' }}>Standing by, Commander. Ask me about any system, or I can walk your latest readouts. What do you need?</p>
            </div>
          </div>

          <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.16em', color: color.text3, marginBottom: 10 }}>SUGGESTED</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {prompts.map(p => (
              <span key={p} style={{ fontFamily: BACTA.FONT_UI, fontSize: 12.5, color: color.text2, background: color.surface, border: `1px solid ${color.line}`, borderRadius: 18, padding: '8px 13px', cursor: 'pointer' }}>{p}</span>
            ))}
          </div>
        </div>

        {/* input bar — lives here, not in the dock */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px 28px', borderTop: `1px solid ${color.line}`, marginTop: 10 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: color.surface, border: `1px solid ${color.line}`, borderRadius: 11, padding: '11px 13px' }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 12.5, color: color.text3, letterSpacing: '0.02em' }}>Message MX-4</span>
            <span style={{ display: 'inline-block', width: 6, height: 14, background: accent, animation: 'mx4blink 1.1s step-end infinite' }} />
          </div>
          <button aria-label="Send" style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 11, border: `1px solid ${hexA(accent, 0.5)}`, background: hexA(accent, 0.14), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="18" x2="18" y2="6"/><polyline points="9,6 18,6 18,15"/></svg>
          </button>
        </div>
      </SheetShell>
    </Sheet>
  );
}

Object.assign(window, { Sheet, SheetShell, SheetHeader, NavSheet, AskSheet });
