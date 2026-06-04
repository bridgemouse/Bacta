/* bacta-v3-dailylog.jsx — Daily Log channel v3.
   Full lifestyle logging UI: behavior tiles, supplement chips, MX-4 correlation,
   interactive tap-to-cycle state. */

const { useState: useStateDL } = React;

// ── Icon glyphs ────────────────────────────────────────────────────────────
function BehaviorIcon({ id, color: c, size = 15 }) {
  const p = { fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {id === 'caffeine'    && <g {...p}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></g>}
      {id === 'alcohol'     && <g {...p}><path d="M8 22l4-11h0l4 11"/><path d="M7 8c0 0 2-1 5-1s5 1 5 1"/><path d="M8 3l-1 5h10L16 3z"/></g>}
      {id === 'preworkout'  && <g {...p}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></g>}
      {id === 'screens'     && <g {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></g>}
      {id === 'lateMeal'    && <g {...p}><path d="M3 11l19-9-9 19-2-8-8-2z"/></g>}
      {id === 'stressEvent' && <g {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></g>}
      {id === 'bedtime'     && <g {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></g>}
      {id === 'dietQuality' && <g {...p}><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M8 12s1.5 3 4 3 4-3 4-3"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></g>}
      {id === 'water'       && <g {...p}><path d="M12 2C6.48 2 2 8 2 13a10 10 0 0 0 20 0c0-5-4.48-11-10-11z"/></g>}
      {id === 'supplements' && <g {...p}><path d="M10.5 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><circle cx="17" cy="17" r="5"/><line x1="17" y1="14" x2="17" y2="20"/><line x1="14" y1="17" x2="20" y2="17"/></g>}
      {id === 'readiness'   && <g {...p}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></g>}
      {id === 'mood'        && <g {...p}><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></g>}
    </svg>
  );
}

// ── Single Behavior Tile ───────────────────────────────────────────────────
function BehaviorTile({ id, label, value, onTap, accent, note }) {
  const { color } = BACTA;
  const logged  = value !== null && value !== undefined;
  const display = Array.isArray(value)
    ? value.length > 0 ? value.length + ' items' : 'none'
    : value === false ? 'No'
    : value === true  ? 'Yes'
    : value != null   ? String(value) : null;
  const ic = logged ? accent : hexA(color.text3, 0.6);

  return (
    <button onClick={onTap} style={{ position: 'relative', textAlign: 'left',
      font: 'inherit', color: 'inherit', cursor: 'pointer',
      background: logged ? hexA(accent, 0.07) : color.surface,
      border: `1px solid ${logged ? hexA(accent, 0.35) : color.line}`,
      borderRadius: 9, padding: '10px 11px',
      display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'background 0.15s, border-color 0.15s', overflow: 'hidden' }}>
      {logged && (
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.8 }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <BehaviorIcon id={id} color={ic} size={14} />
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, fontWeight: 600,
          letterSpacing: '0.06em', color: logged ? color.text : color.text3,
          textTransform: 'uppercase', flex: 1, minWidth: 0, lineHeight: 1.2 }}>{label}</span>
        {logged && <StatusCore accent={accent} size={5} />}
      </div>
      {logged ? (
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 13, fontWeight: 700,
          color: color.text, lineHeight: 1 }}>{display}</span>
      ) : (
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: hexA(color.text3, 0.5) }}>
          + LOG
        </span>
      )}
      {note && (
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: hexA(color.text3, 0.7) }}>
          {note}
        </span>
      )}
    </button>
  );
}

// ── Supplement Row ─────────────────────────────────────────────────────────
const ALL_SUPPS = ['Omega-3', 'Magnesium', 'Vit D', 'Creatine', 'Zinc', 'Multi'];

function SupplementRow({ selected, onToggle, accent }) {
  const { color } = BACTA;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {ALL_SUPPS.map(s => {
        const on = selected.includes(s);
        return (
          <button key={s} onClick={() => onToggle(s)}
            style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.06em', padding: '5px 11px', borderRadius: 20,
              border: `1px solid ${on ? hexA(accent, 0.6) : color.line}`,
              background: on ? hexA(accent, 0.14) : 'transparent',
              color: on ? color.text : color.text3,
              cursor: 'pointer', font: 'inherit',
              transition: 'all 0.15s ease' }}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

// ── Cycle helpers ──────────────────────────────────────────────────────────
const CAFFEINE_OPTS  = [null, 100, 200, 300, 400];
const ALCOHOL_OPTS   = [null, 0, 1, 2, 3, 4];
const SCREENS_OPTS   = [null, 'None', '30m', '1h+'];
const STRESS_OPTS    = [null, 'None', 'Mild', 'High'];
const DIET_OPTS      = [null, 1, 2, 3, 4, 5];
const WATER_OPTS     = [null, 2, 4, 6, 8, 10, 12];
const MOOD_OPTS      = [null, 'Great', 'Good', 'Meh', 'Rough'];
const READY_OPTS     = [null, 1, 2, 3, 4, 5];

function cycleOpt(opts, cur) {
  const idx = opts.findIndex(v =>
    v === null ? cur === null : String(v) === String(cur));
  return opts[(idx + 1) % opts.length];
}

// ── Daily Log View ─────────────────────────────────────────────────────────
function DailyLogView({ tab }) {
  const { color } = BACTA;
  const accent = BACTA.section.dailylog.accent;
  const init = BACTA.metrics.dailylog.behaviors;

  const [log, setLog] = useStateDL({ ...init });

  const set = (key, val) => setLog(prev => ({ ...prev, [key]: val }));
  const toggleSupp = s => setLog(prev => {
    const cur = prev.supplements;
    return { ...prev, supplements: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s] };
  });

  // Count logged (non-null, non-undefined)
  const loggedCount = Object.entries(log).filter(([k, v]) => {
    if (k === 'supplements') return v.length > 0;
    if (k === 'caffeineTime') return false;
    return v !== null;
  }).length;
  const totalBehaviors = 12;

  const Section = ({ label, children }) => (
    <div style={{ marginBottom: 11 }}>
      <Rail label={label} accent={accent} right="" />
      {children}
    </div>
  );

  return (
    <RecScroll>
      <MX4Briefing channel="dailylog" brief={BACTA.brief.dailylog} label="DAILY LOG" />

      {/* Date + completion header */}
      <InfoCard id="dl-header" size="pair" noStretch accent={accent} radius={12} style={{ marginBottom: 11 }}
        title="Daily Log"
        description="Daily logging creates the behavioral dataset MX-4 needs to find your personal patterns. Sleep quality, HRV, and recovery scores alone can't explain why things changed — your logs provide the 'why'. 21+ consecutive days unlocks statistical correlation between behaviors and outcomes."
        source="Bacta Daily Log · manual entry">
      <div style={{ position: 'relative', background: color.surface,
        border: `1px solid ${hexA(accent, 0.3)}`, borderRadius: 12,
        padding: '13px 15px', overflow: 'hidden' }}>
        <Bracket color={accent} inset={6} op={0.4} />
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.85 }} />
        <div style={{ display: 'flex', alignItems: 'center',
          justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.16em',
              color: color.text3, marginBottom: 5 }}>{BACTA.metrics.dailylog.date}</div>
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 22, fontWeight: 700,
              color: color.text, lineHeight: 1 }}>{loggedCount}
              <span style={{ fontSize: 11, color: color.text3, fontWeight: 400 }}>
                {' '}/ {totalBehaviors} logged
              </span>
            </div>
            <div style={{ marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 9px', borderRadius: 20,
              background: hexA(accent, 0.12), border: `1px solid ${hexA(accent, 0.38)}` }}>
              <StatusCore accent={accent} size={5} />
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, fontWeight: 700,
                letterSpacing: '0.08em', color: accent }}>
                {loggedCount >= 8 ? 'COMPLETE' : loggedCount >= 4 ? 'IN PROGRESS' : 'EARLY'}
              </span>
            </div>
          </div>
          <div style={{ width: 72, height: 72 }}>
            <Ring progress={loggedCount / totalBehaviors} accent={accent} size={72} stroke={5}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 14, fontWeight: 700,
                color: color.text }}>{Math.round(loggedCount / totalBehaviors * 100)}%</span>
            </Ring>
          </div>
        </div>
      </div>
      </InfoCard>

      {/* STIMULANTS */}
      <Section label="STIMULANTS">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 9 }}>
          <BehaviorTile id="caffeine" label="Caffeine"
            value={log.caffeine != null ? `${log.caffeine}mg` : null}
            onTap={() => set('caffeine', cycleOpt(CAFFEINE_OPTS, log.caffeine))}
            accent={accent} />
          <BehaviorTile id="alcohol" label="Alcohol"
            value={log.alcohol != null ? log.alcohol === 0 ? '0 drinks' : `${log.alcohol} drink${log.alcohol !== 1 ? 's' : ''}` : null}
            onTap={() => set('alcohol', cycleOpt(ALCOHOL_OPTS, log.alcohol))}
            accent={accent} />
          <BehaviorTile id="preworkout" label="Pre-WO"
            value={log.preworkout === null ? null : log.preworkout ? 'Yes' : 'No'}
            onTap={() => set('preworkout', log.preworkout === null ? false : log.preworkout === false ? true : null)}
            accent={accent} />
        </div>
      </Section>

      {/* SLEEP FACTORS */}
      <Section label="SLEEP FACTORS">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 9 }}>
          <BehaviorTile id="screens" label="Screens before bed"
            value={log.screens}
            onTap={() => set('screens', cycleOpt(SCREENS_OPTS, log.screens))}
            accent={accent} note="last 30 min" />
          <BehaviorTile id="lateMeal" label="Late meal"
            value={log.lateMeal === null ? null : log.lateMeal ? 'Yes' : 'No'}
            onTap={() => set('lateMeal', log.lateMeal === null ? false : log.lateMeal === false ? true : null)}
            accent={accent} note=">9pm" />
          <BehaviorTile id="stressEvent" label="Stress event"
            value={log.stressEvent}
            onTap={() => set('stressEvent', cycleOpt(STRESS_OPTS, log.stressEvent))}
            accent={accent} />
          <BehaviorTile id="bedtime" label="In bed 22:30"
            value={log.bedtime === null ? null : log.bedtime ? 'Yes' : 'Missed'}
            onTap={() => set('bedtime', log.bedtime === null ? true : log.bedtime === true ? false : null)}
            accent={accent} />
        </div>
      </Section>

      {/* RECOVERY */}
      <Section label="RECOVERY INPUTS">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 9 }}>
          <BehaviorTile id="dietQuality" label="Diet quality"
            value={log.dietQuality != null ? `${log.dietQuality} / 5` : null}
            onTap={() => set('dietQuality', cycleOpt(DIET_OPTS, log.dietQuality))}
            accent={accent} />
          <BehaviorTile id="water" label="Water"
            value={log.water != null ? `${log.water} glasses` : null}
            onTap={() => set('water', cycleOpt(WATER_OPTS, log.water))}
            accent={accent} />
        </div>

        {/* Supplements — full-width row */}
        <div style={{ position: 'relative', background: color.surface,
          border: `1px solid ${log.supplements.length > 0 ? hexA(accent, 0.35) : color.line}`,
          borderRadius: 9, padding: '11px 13px', marginBottom: 0, overflow: 'hidden' }}>
          {log.supplements.length > 0 && (
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.8 }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BehaviorIcon id="supplements" color={log.supplements.length > 0 ? accent : hexA(BACTA.color.text3, 0.6)} size={14} />
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, fontWeight: 600,
                letterSpacing: '0.06em', color: log.supplements.length > 0 ? color.text : color.text3,
                textTransform: 'uppercase' }}>Supplements</span>
            </div>
            {log.supplements.length > 0 && (
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, fontWeight: 700,
                color: accent }}>{log.supplements.length} LOGGED</span>
            )}
          </div>
          <SupplementRow selected={log.supplements} onToggle={toggleSupp} accent={accent} />
        </div>
      </Section>

      {/* READINESS */}
      <Section label="READINESS CHECK">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <BehaviorTile id="readiness" label="How do you feel"
            value={log.readiness != null ? `${log.readiness} / 5` : null}
            onTap={() => set('readiness', cycleOpt(READY_OPTS, log.readiness))}
            accent={accent} />
          <BehaviorTile id="mood" label="Mood"
            value={log.mood}
            onTap={() => set('mood', cycleOpt(MOOD_OPTS, log.mood))}
            accent={accent} />
        </div>
      </Section>

      {/* MX-4 correlation footer */}
      <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: 10,
        background: hexA(accent, 0.06), border: `1px solid ${hexA(accent, 0.2)}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <MX4Sigil color={accent} size={14} spin mood="think" />
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.12em',
            color: accent, fontWeight: 700 }}>MX-4 CORRELATION HINT</span>
        </div>
        <p style={{ margin: 0, fontFamily: BACTA.FONT_UI, fontSize: 13, lineHeight: 1.5,
          color: color.text2 }}>
          7 more logs needed for statistical confidence. Keep going — magnesium + zero alcohol is your current strongest HRV signal.
        </p>
      </div>
    </RecScroll>
  );
}

Object.assign(window, { DailyLogView });
