/* bacta-v3-bloodwork.jsx — Labs channel v3 + InfoCard on summary card.
   Panel accordions use their own tap (expand) so they get stopPropagation. */

const { useState: useStateBW } = React;

function MarkerRangeBar({ val, lo, hi, accent }) {
  const { color } = BACTA;
  const pad = (hi - lo) * 0.25;
  const dlo = lo - pad, dhi = hi + pad;
  const range = dhi - dlo || 1;
  const pct  = Math.max(0, Math.min(100, ((val - dlo) / range) * 100));
  const loP  = Math.max(0, ((lo - dlo) / range) * 100);
  const hiP  = Math.min(100, ((hi - dlo) / range) * 100);
  const inRange = val >= lo && val <= hi;
  const c = inRange ? color.green : color.red;
  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: hexA(color.text3, 0.1), overflow: 'visible', width: '100%' }}>
      <div style={{ position: 'absolute', left: `${loP}%`, width: `${hiP - loP}%`, height: '100%', background: hexA(color.green, 0.2), borderRadius: 2 }} />
      <div style={{ position: 'absolute', top: -3, left: `calc(${pct}% - 5px)`, width: 12, height: 12, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${hexA(c, 0.45)}` }} />
    </div>
  );
}

function MarkerRow({ m, accent }) {
  const { color } = BACTA;
  const inRange = m.val >= m.lo && m.val <= m.hi;
  const c = inRange ? color.green : color.red;
  const rangeStr = m.hi >= 900 ? `>${m.lo}` : `${m.lo}–${m.hi}`;
  const valStr = m.dp > 0 ? m.val.toFixed(m.dp) : String(m.val);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '6px 12px', padding: '9px 0', borderBottom: `1px solid ${hexA(color.text3, 0.08)}` }}>
      <div>
        <div style={{ fontFamily: BACTA.FONT_UI, fontSize: 13, fontWeight: 500, color: color.text, marginBottom: 5 }}>{m.name}</div>
        <MarkerRangeBar val={m.val} lo={m.lo} hi={m.hi} accent={accent} />
        <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginTop: 4 }}>ref {rangeStr} {m.unit}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 14, fontWeight: 700, color: color.text, lineHeight: 1 }}>{valStr}</span>
        <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3, display: 'block', marginTop: 1 }}>{m.unit}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: hexA(c, 0.1), border: `1px solid ${hexA(c, 0.35)}` }}>
        {inRange
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        }
      </div>
    </div>
  );
}

// Panel descriptions keyed by panel id
const PANEL_INFO = {
  hormones:  'Hormones regulate nearly every system in your body. Testosterone and DHEA support muscle synthesis, mood, and recovery. Estradiol and LH give context for sex hormone balance. These shift with training load, sleep, and age.',
  thyroid:   'Thyroid hormones (TSH, T3, T4) control metabolic rate, energy production, and thermoregulation. Subclinical hypothyroidism — even with TSH in range — can impair recovery and VO2 Max. T3 is the active form; TSH is the pituitary signal.',
  metabolic: 'Metabolic markers reflect how efficiently you process glucose and manage inflammation. HbA1c is a 90-day average blood sugar snapshot. hs-CRP is a sensitive inflammation marker — yours at 0.4 mg/L confirms minimal systemic stress.',
  lipids:    'Cardiovascular risk panel. LDL carries cholesterol to arteries; HDL removes it. A high HDL:LDL ratio and low triglycerides are associated with significantly reduced cardiovascular risk. Endurance training reliably improves all four markers.',
  vitamins:  'Micronutrient status. Ferritin is your iron storage — critical for oxygen transport and endurance. Vitamin D acts as a hormone, supporting immune function, muscle recovery, and testosterone production. B12 supports neurological function and red blood cell formation.',
  cbc:       'Complete Blood Count — a snapshot of your blood cell populations. Hemoglobin and hematocrit reflect oxygen-carrying capacity. WBC elevation can indicate infection or inflammation. Platelets are involved in clotting and recovery signaling.',
};

function PanelAccordion({ panel, accent, defaultOpen = false }) {
  const [open, setOpen] = useStateBW(defaultOpen);
  const { color } = BACTA;
  const total   = panel.markers.length;
  const flagged = panel.markers.filter(m => m.val < m.lo || m.val > m.hi).length;
  const allGreen = flagged === 0;
  const sc = allGreen ? color.green : color.red;

  return (
    <InfoCard id={`labs-panel-${panel.id}`} accent={accent} radius={10}
      style={{ marginBottom: 8 }}
      title={panel.label}
      description={PANEL_INFO[panel.id] || `${panel.label} panel — ${total} markers tracked.`}
      source="Labwork · Mar 15, 2026">
      <div style={{ background: color.surface, border: `1px solid ${open ? hexA(accent, 0.35) : color.line}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.18s ease' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, color: accent, flexShrink: 0, display: 'block', lineHeight: 1, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s ease' }}>›</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: color.text2, flex: 1 }}>{panel.label}</span>
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: color.text3 }}>{total} markers</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: hexA(sc, 0.1), border: `1px solid ${hexA(sc, 0.35)}` }}>
            <StatusCore accent={sc} size={5} />
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, fontWeight: 700, color: sc }}>{allGreen ? 'CLEAN' : `${flagged} FLAG`}</span>
          </div>
        </button>
        {open && (
          <div style={{ borderTop: `1px solid ${hexA(accent, 0.18)}`, padding: '0 14px 4px' }}>
            {panel.markers.map(m => <MarkerRow key={m.name} m={m} accent={accent} />)}
          </div>
        )}
      </div>
    </InfoCard>
  );
}

function BloodWorkView({ tab }) {
  const { color } = BACTA;
  const accent  = BACTA.section.bloodwork.accent;
  const bw      = BACTA.metrics.bloodwork;
  const total   = bw.panels.reduce((s, p) => s + p.markers.length, 0);
  const flagged = bw.panels.reduce((s, p) => s + p.markers.filter(m => m.val < m.lo || m.val > m.hi).length, 0);

  return (
    <RecScroll>
      <MX4Briefing channel="bloodwork" brief={BACTA.brief.bloodwork} label="LABS" />

      <InfoCard id="labs-summary" size="chart" noStretch accent={accent} radius={12} style={{ marginBottom: 11 }}
        title="Lab Panel Overview"
        description="Your blood panel gives MX-4 context that wearables cannot provide: hormone baselines, metabolic markers, cardiovascular risk, and micronutrient status. Combined with daily Garmin data it enables correlation between lifestyle choices and biomarker trends over months. Tap any panel below for details."
        source="Labwork · Mar 15, 2026">
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${hexA(accent, 0.3)}`, borderRadius: 12, padding: '13px 15px', overflow: 'hidden' }}>
          <Bracket color={accent} inset={6} op={0.4} />
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.85 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3h6v6l4.5 8a2.5 2.5 0 0 1-2.2 3.5H6.7A2.5 2.5 0 0 1 4.5 17L9 9V3z" />
                  <line x1="9" y1="3" x2="15" y2="3" />
                  <path d="M7 16.5h10" strokeOpacity="0.4" />
                </svg>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, letterSpacing: '0.14em', color: color.text3 }}>LAST PANEL · {bw.lastUpdated}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 32, fontWeight: 700, color: color.text, lineHeight: 1 }}>{total - flagged}</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 12, color: color.text3 }}>/ {total} in range</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 20, background: hexA(color.green, 0.12), border: `1px solid ${hexA(color.green, 0.4)}` }}>
                <StatusCore accent={color.green} size={6} />
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, fontWeight: 700, color: color.green, letterSpacing: '0.08em' }}>{flagged === 0 ? 'ALL CLEAR' : `${flagged} FLAGS`}</span>
              </div>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3 }}>{bw.panels.length} panels · retest Sep 2026</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {bw.panels.map(p => {
              const pFlagged = p.markers.filter(m => m.val < m.lo || m.val > m.hi).length;
              const c = pFlagged === 0 ? color.green : color.red;
              return (
                <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 20, background: hexA(c, 0.08), border: `1px solid ${hexA(c, 0.28)}`, color: c }}>
                  ● {p.label}
                </span>
              );
            })}
          </div>
        </div>
      </InfoCard>

      <Rail label="PANELS" accent={accent} right={`${bw.panels.length} PANELS · ${total} MARKERS`} style={{ marginTop: 4 }} />
      {bw.panels.map((p, i) => <PanelAccordion key={p.id} panel={p} accent={accent} defaultOpen={i === 0} />)}

      <div style={{ marginTop: 4, padding: '11px 14px', borderRadius: 9, background: hexA(accent, 0.05), border: `1px solid ${hexA(accent, 0.18)}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <MX4Sigil color={accent} size={13} spin mood="idle" />
          <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, letterSpacing: '0.12em', color: accent, fontWeight: 700 }}>NEXT PANEL RECOMMENDATION</span>
        </div>
        <p style={{ margin: '7px 0 0', fontFamily: BACTA.FONT_UI, fontSize: 13, lineHeight: 1.5, color: color.text2 }}>
          Schedule repeat panel for Sep 2026. Add hs-CRP, ferritin, and vitamin D — track inflammation and micronutrient trajectory over 6 months.
        </p>
      </div>
    </RecScroll>
  );
}

Object.assign(window, { BloodWorkView });
