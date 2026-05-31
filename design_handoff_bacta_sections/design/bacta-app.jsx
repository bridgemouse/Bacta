/* bacta-app.jsx — stateful Bacta prototype: chrome + home + section shells +
   nav/ask sheets. MX-4 adopts the channel color per section (contextual color). */

const { useState: useStateApp } = React;

/* Section shell — styled placeholder until each backend is wired in */
function SectionShell({ sectionKey }) {
  const { color } = BACTA;
  const s = BACTA.section[sectionKey];
  const accent = s.accent;
  const t = BACTA.tiles.find(x => x.key === sectionKey);
  const greetings = {
    recovery:  'Recovery channel online. Battery and HRV trends will surface here once the system is wired in.',
    training:  'Training channel online. Load, blocks, and session protocols will populate here.',
    sleep:     'Sleep channel online. Stages, score, and debt readouts will live here.',
    nutrition: 'Nutrition channel online. Intake, macros, and targets will surface here.',
    bloodwork: 'Blood Work channel online. Panels, biomarkers, and flags will populate here.',
    dailylog:  'Daily Log channel online. Your entries and check-ins will live here.',
  };
  return (
    <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overscrollBehavior: 'none', padding: '13px 13px 8px' }}>
      <TransmissionPanel accent={accent} mood="transmit" label={`MX-4 // ${s.label.toUpperCase()}`} meta="STANDBY"
        assessment={greetings[sectionKey]} chips={[['CH', s.label.toUpperCase()], ['DATA', 'PENDING']]} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.2em', color: accent }}>{s.label.toUpperCase()}</span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${hexA(accent, 0.4)}, ${color.line})` }} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>CALIBRATING</span>
      </div>

      {/* skeleton instrument cards (shimmer) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 9, padding: 14, overflow: 'hidden' }}>
            <Bracket color={accent} inset={6} op={0.32} radius={4} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: hexA(accent, 0.14) }} />
              <span style={{ ...shimmerBar(accent), width: i === 0 ? 120 : i === 1 ? 90 : 104, height: 9 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 46 }}>
              {[0.5, 0.8, 0.4, 0.95, 0.65, 0.85, 0.55].map((h, j) => (
                <span key={j} style={{ ...shimmerBar(accent), flex: 1, height: `${h * 100}%`, borderRadius: 3 }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 0 6px' }}>
        <MX4Sigil color={accent} size={15} spin mood="think" />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.1em', color: color.text3 }}>MX-4 IS CALIBRATING THIS SYSTEM</span>
      </div>
    </div>
  );
}

function shimmerBar(accent) {
  return {
    display: 'block',
    background: `linear-gradient(90deg, ${hexA(accent, 0.06)} 25%, ${hexA(accent, 0.16)} 50%, ${hexA(accent, 0.06)} 75%)`,
    backgroundSize: '200% 100%',
    borderRadius: 4,
    animation: 'mx4shimmer 1.6s ease-in-out infinite',
  };
}

function BactaApp() {
  const { color } = BACTA;
  const [view, setView] = useStateApp('home');
  const [tab, setTab] = useStateApp('overview');
  const [nav, setNav] = useStateApp(false);
  const [ask, setAsk] = useStateApp(false);
  const isHome = view === 'home';
  const accent = isHome ? BACTA.home.accent : BACTA.section[view].accent;
  const BUILT = { home: true, recovery: true, sleep: true, training: true };
  const built = !!BUILT[view];
  const go = (k) => { setView(k); setTab('overview'); };

  let body;
  if (view === 'home') body = <HomeView tab={tab} onOpenSection={go} />;
  else if (view === 'recovery') body = <RecoveryView tab={tab} />;
  else if (view === 'sleep') body = <SleepView tab={tab} />;
  else if (view === 'training') body = <TrainingView tab={tab} />;
  else body = <SectionShell sectionKey={view} />;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.base, fontFamily: BACTA.FONT_UI, color: color.text, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, ...bactaTexture(accent), pointerEvents: 'none', zIndex: 0 }} />

      {isHome
        ? <BactaStatusBar accent={BACTA.home.accent} />
        : <BactaStatusBar accent={accent} title={BACTA.section[view].label.toUpperCase()} sectionKey={view} onBack={() => go('home')} />}

      {body}

      <BactaDock accent={accent} onAsk={() => setAsk(true)} onNav={() => setNav(true)} tab={tab} onTab={setTab} showTabs={built} />

      <NavSheet open={nav} onClose={() => setNav(false)} current={view} onNavigate={(k) => { go(k); setNav(false); }} />
      <AskSheet open={ask} onClose={() => setAsk(false)} accent={accent} />
    </div>
  );
}

Object.assign(window, { SectionShell, BactaApp });
