/* bacta-data.jsx — Round-2 metric model. Real Garmin-shaped data for the three
   live channels (Recovery, Sleep, Training) + the Home synthesis. 7-day trend
   arrays end on TODAY (Mon). Attaches BACTA.metrics + BACTA.brief + helpers. */

const DAY = ['Tu', 'We', 'Th', 'Fr', 'Sa', 'Su', 'Mo']; // window ends today (Mon)

BACTA.day = DAY;

/* MX-4's per-channel briefings — tone drives the card's whole aura.
   Each one is written in his voice and is contextually true to the data. */
BACTA.brief = {
  home: {
    tone: 'positive', mood: 'transmit', meta: 'MON · MAY 29 · 06:00',
    line: 'Recovery is charged and HRV is up seven points. You slept long but lightly — REM ran short. Training is productive, though load is creeping. One clean aerobic day keeps the whole system green.',
    chips: [['SYNTHESIS', '3 CH'], ['FLAGS', '0'], ['WATCH', 'LOAD']],
  },
  recovery: {
    tone: 'positive', mood: 'pleased', meta: 'LAST NIGHT · 11:42–06:31',
    line: 'Strong overnight. HRV climbed to 61ms, well above your 54ms baseline, and Body Battery topped out at 88. Resting heart rate is your lowest this week. You are cleared for a hard session.',
    chips: [['HRV', '+7ms'], ['READY', '74'], ['FLAGS', '0']],
  },
  sleep: {
    tone: 'caution', mood: 'alert', meta: 'TIME IN BED · 8H 20M',
    line: 'Duration was generous at 8h 06m, but the night was light — REM held but deep sleep finished early and you stirred near 03:00. Score lands at 82. Protect tomorrow night: no screens past 22:30.',
    chips: [['SCORE', '82'], ['DEEP', 'LOW'], ['TONE', 'WATCH']],
  },
  training: {
    tone: 'positive', mood: 'transmit', meta: 'BLOCK 4 / 8 · BUILD',
    line: 'Status holds at Productive — VO2max ticked to 52. Acute load is 342 and climbing toward the top of your optimal band. Today\u2019s run logged clean. Keep the next session aerobic to bank the adaptation.',
    chips: [['STATUS', 'PRODUCTIVE'], ['LOAD', '342'], ['VO2', '52']],
  },
};

/* ── RECOVERY ─────────────────────────────────────────────────── */
BACTA.metrics = {
  recovery: {
    score:   { value: 74, label: 'Recovery', state: 'Ready', trend: [62, 66, 60, 70, 68, 72, 74] },
    hrv:     { value: 61, unit: 'ms', avg: 54, trend: [49, 53, 51, 56, 55, 58, 61] },
    battery: { now: 74, max: 88, min: 22, trend: [80, 84, 79, 88, 85, 86, 88] },
    rhr:     { value: 48, unit: 'bpm', avg: 50, trend: [52, 51, 50, 49, 50, 49, 48], lowerBetter: true },
    stress:  { value: 28, unit: 'avg', avg: 31, trend: [34, 30, 33, 28, 31, 27, 28], lowerBetter: true, max: 100 },
    spo2:    { value: 96, unit: '%', avg: 96, trend: [95, 96, 95, 96, 96, 95, 96] },
    resp:    { value: 14, unit: 'br/min', avg: 14, trend: [15, 14, 15, 14, 14, 15, 14], lowerBetter: true },
  },

  /* ── SLEEP ──────────────────────────────────────────────────── */
  sleep: {
    duration: { h: 8, m: 6, mins: 486, inBed: 500, trend: [432, 408, 474, 504, 456, 480, 486] },
    score:    { value: 82, state: 'Good', trend: [74, 70, 80, 85, 78, 81, 82] },
    stages: [
      { key: 'deep',  label: 'Deep',  mins: 87,  pct: 18, color: '#7c5cff' },
      { key: 'light', label: 'Light', mins: 277, pct: 57, color: '#a78bfa' },
      { key: 'rem',   label: 'REM',   mins: 122, pct: 25, color: '#c4b5fd' },
      { key: 'awake', label: 'Awake', mins: 14,  pct: 0,  color: '#56657a' },
    ],
    // overnight hypnogram — level per ~25min block (3 deep, 2 light, 1 rem, 0 awake)
    hypno: [0, 2, 3, 3, 2, 1, 3, 3, 2, 1, 1, 2, 3, 2, 1, 0, 1, 2, 2, 1, 1, 2, 1, 0],
    spo2: { avg: 95, low: 91, unit: '%' },
    resp: { avg: 13, unit: 'br/min' },
  },

  /* ── TRAINING ───────────────────────────────────────────────── */
  training: {
    status:    { value: 'Productive', sub: 'Block 4 of 8', trend: [50, 50, 51, 51, 51, 52, 52] },
    vo2max:    { value: 52, unit: 'mL/kg/min', delta: +1, fitnessAge: 31 },
    load:      { value: 342, low: 280, high: 420, state: 'Optimal', trend: [280, 300, 260, 320, 340, 310, 342] },
    endurance: { value: 71, label: 'Endurance', state: 'Trained', trend: [64, 66, 65, 68, 69, 70, 71] },
    intensity: { moderate: 210, vigorous: 75, goal: 150, trend: [22, 40, 0, 55, 30, 48, 60] },
    activities: [
      { type: 'Run',      sigil: 'run',      dist: '10.2 km', dur: '52:14', kcal: 612, hr: 148, when: 'TODAY · 06:40',  feel: 'Aerobic' },
      { type: 'Strength', sigil: 'strength', dist: null,      dur: '48:00', kcal: 320, hr: 112, when: 'SUN · 17:20',    feel: 'Upper' },
      { type: 'Trail Run', sigil: 'run',     dist: '8.5 km',  dur: '47:30', kcal: 540, hr: 152, when: 'SAT · 07:05',    feel: 'Tempo' },
    ],
  },
};

/* ── HOME synthesis — one signal per live channel ─────────────── */
BACTA.signals = [
  { key: 'recovery', headline: '74',     unit: 'battery', sub: 'HRV 61ms · +7ms',             state: 'Ready',      tone: 'positive', trend: [62, 66, 60, 70, 68, 72, 74] },
  { key: 'sleep',    headline: '8h 06m', unit: '',        sub: 'Score 82 · REM short',        state: 'Good',       tone: 'caution',  trend: [432, 408, 474, 504, 456, 480, 486] },
  { key: 'training', headline: 'Productive', unit: '',    sub: 'Load 342 · VO2 52',           state: 'Build',      tone: 'positive', trend: [280, 300, 260, 320, 340, 310, 342] },
];

/* not-yet-wired channels — shown honestly as offline, no fabricated data */
BACTA.pending = ['nutrition', 'bloodwork', 'dailylog'];

/* fmt helpers */
BACTA.fmtDur = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
