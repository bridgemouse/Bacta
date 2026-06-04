/* bacta-v3-app.jsx — v3 app shell override.
   Adds: dailylog + bloodwork to BUILT map, SyncButton in status bar. */

const {
  useState:  useStateSB,
  useEffect: useEffectSB,
  useRef:    useRefSB,
} = React;

const MX4C = '#2bc4e8';

// ── Sync Button ────────────────────────────────────────────────────────────
function SyncButton() {
  const { color } = BACTA;
  // states: 'idle' | 'syncing' | 'done' | 'failed'
  const [phase,   setPhase]   = useStateSB('idle');
  const [elapsed, setElapsed] = useStateSB(0);
  const tickRef   = useRefSB(null);
  const resetRef  = useRefSB(null);
  const pollRef   = useRefSB(null);

  const finish = (result) => {
    clearInterval(tickRef.current);
    clearInterval(pollRef.current);
    setPhase(result);                          // 'done' or 'failed'
    resetRef.current = setTimeout(() => setPhase('idle'), result === 'done' ? 2500 : 3500);
  };

  const startSync = async () => {
    if (phase === 'syncing') return;
    clearTimeout(resetRef.current);
    setPhase('syncing');
    setElapsed(0);
    const t0 = Date.now();
    tickRef.current = setInterval(() =>
      setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);

    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST' });
      if (!res.ok) throw new Error('sync rejected');

      // Poll status until done or error
      pollRef.current = setInterval(async () => {
        try {
          const r   = await fetch('/api/garmin/sync/status');
          const { status } = await r.json();
          if (status === 'done')  finish('done');
          if (status === 'error') finish('failed');
        } catch { finish('failed'); }
      }, 1500);

    } catch {
      // No real server in prototype — simulate a 9s sync
      const simTimer = setTimeout(() => finish('done'), 9000);
      // Expose cancel in case component unmounts
      tickRef.current && (tickRef.current._sim = simTimer);
    }
  };

  useEffectSB(() => () => {
    clearInterval(tickRef.current);
    clearInterval(pollRef.current);
    clearTimeout(resetRef.current);
  }, []);

  const isSyncing = phase === 'syncing';
  const isDone    = phase === 'done';
  const isFailed  = phase === 'failed';
  const bc = isDone ? color.green : isFailed ? color.red : MX4C;

  return (
    <button
      onClick={startSync}
      disabled={isSyncing}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 20,
        background: hexA(bc, 0.1), border: `1px solid ${hexA(bc, 0.42)}`,
        cursor: isSyncing ? 'default' : 'pointer',
        font: 'inherit', color: 'inherit',
        transition: 'background 0.25s, border-color 0.25s',
      }}>
      {/* Icon */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke={bc} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, animation: isSyncing ? 'mx4spin 0.9s linear infinite' : 'none' }}>
        {isDone && <polyline points="20,6 9,17 4,12" />}
        {isFailed && <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
        {(phase === 'idle' || isSyncing) && (
          <>
            <path d="M21 2v6h-6"/>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
            <path d="M3 22v-6h6"/>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </>
        )}
      </svg>
      <span style={{
        fontFamily: BACTA.FONT_MONO, fontSize: 9, fontWeight: 700,
        letterSpacing: '0.1em', color: bc, whiteSpace: 'nowrap',
      }}>
        {isDone    ? 'DONE'
         : isFailed ? 'FAILED'
         : isSyncing ? `${elapsed}s`
         : 'SYNC'}
      </span>
    </button>
  );
}

// ── Status Bar with Sync ───────────────────────────────────────────────────
function BactaStatusBarV3({ accent = MX4C, title, sectionKey, onBack }) {
  const { color } = BACTA;
  return (
    <div style={{
      position: 'relative', zIndex: 1,
      background: 'rgba(17,24,39,0.92)',
      borderBottom: `1px solid ${hexA(accent, 0.28)}`,
      padding: '50px 15px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
      boxShadow: `0 1px 0 ${hexA(accent, 0.12)}`,
    }}>
      {/* Left — back or home */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {onBack ? (
          <>
            <button onClick={onBack} aria-label="Back" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, marginLeft: -4, display: 'flex' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={color.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15,5 8,12 15,19"/>
              </svg>
            </button>
            <Sigil name={sectionKey} color={accent} size={16} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11.5, fontWeight: 700,
              letterSpacing: '0.12em', color: accent }}>{title}</span>
          </>
        ) : (
          <>
            <MX4Sigil color={MX4C} size={18} spin mood="idle" />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11.5, fontWeight: 700,
              letterSpacing: '0.12em' }}>
              BACTA<span style={{ color: color.text3 }}>·OS</span>
            </span>
          </>
        )}
      </div>

      {/* Right — MX-4 status + Sync button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusCore accent={color.green} size={6} />
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, color: color.green,
            fontWeight: 600, letterSpacing: '0.08em' }}>MX-4 ONLINE</span>
        </div>
        <span style={{ width: 1, height: 14, background: hexA(MX4C, 0.25), flexShrink: 0 }} />
        <SyncButton />
      </div>
    </div>
  );
}

// ── App V3 ─────────────────────────────────────────────────────────────────
function BactaAppV3() {
  const { color } = BACTA;
  const [view, setView] = React.useState('home');
  const [tab,  setTab]  = React.useState('overview');
  const [nav,  setNav]  = React.useState(false);
  const [ask,  setAsk]  = React.useState(false);

  const isHome = view === 'home';
  const accent = isHome ? BACTA.home.accent : BACTA.section[view].accent;
  const BUILT  = { home: true, recovery: true, sleep: true, training: true, dailylog: true, bloodwork: true };
  const go     = k => { setView(k); setTab('overview'); };

  let body;
  if      (view === 'home')      body = <HomeView tab={tab} onOpenSection={go} />;
  else if (view === 'recovery')  body = <RecoveryView  tab={tab} />;
  else if (view === 'sleep')     body = <SleepView     tab={tab} />;
  else if (view === 'training')  body = <TrainingView  tab={tab} />;
  else if (view === 'dailylog')  body = <DailyLogView  tab={tab} />;
  else if (view === 'bloodwork') body = <BloodWorkView tab={tab} />;
  else body = <SectionShell sectionKey={view} />;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex',
      flexDirection: 'column', background: color.base,
      fontFamily: BACTA.FONT_UI, color: color.text, overflow: 'hidden' }}>

      {isHome
        ? <BactaStatusBarV3 accent={BACTA.home.accent} />
        : <BactaStatusBarV3 accent={accent}
            title={BACTA.section[view].label.toUpperCase()}
            sectionKey={view} onBack={() => go('home')} />}

      {body}

      <BactaDock accent={accent} onAsk={() => setAsk(true)} onNav={() => setNav(true)}
        tab={tab} onTab={setTab} showTabs={!!BUILT[view]} />

      <NavSheet open={nav} onClose={() => setNav(false)} current={view}
        onNavigate={k => { go(k); setNav(false); }} />
      <AskSheet open={ask} onClose={() => setAsk(false)} accent={accent} />
    </div>
  );
}

Object.assign(window, { BactaApp: BactaAppV3, BactaStatusBar: BactaStatusBarV3 });
