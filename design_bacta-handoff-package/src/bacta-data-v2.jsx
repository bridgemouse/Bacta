/* bacta-data-v2.jsx — Real Garmin data for Bacta prototype v2.
   Loads AFTER bacta-data.jsx and overrides BACTA.metrics, BACTA.brief,
   BACTA.tiles, BACTA.signals with real values from garmin_snapshots 2026-06-02. */

// ── MX-4 briefings ────────────────────────────────────────────────────────
BACTA.brief = {
  home: {
    tone: 'positive', mood: 'transmit', meta: 'MON · JUN 2 · 06:23',
    line: 'All systems green. Body Battery woke at 100% and HRV held inside your baseline band. Sleep score hit 92 — a genuinely excellent night. Training load sits at 505, squarely in your optimal range. Only flag: steps at 7,137 are short of 10k.',
    chips: [['HRV', 'IN RANGE'], ['BATTERY', '100%'], ['STATUS', 'PRODUCTIVE']],
  },
  recovery: {
    tone: 'positive', mood: 'pleased', meta: 'LAST NIGHT · 22:30–06:23',
    line: 'Strong overnight. HRV hit 66ms — four above your 62ms week average and inside the 56–71ms baseline. Body Battery maxed at 100% and has only shed 22 points since wake. RHR is 43bpm, your lowest this week. Cleared for intensity.',
    chips: [['HRV', '+4ms'], ['BATTERY', '100%'], ['RHR', '43 bpm']],
  },
  sleep: {
    tone: 'positive', mood: 'pleased', meta: 'TIME IN BED · 8H 17M',
    line: 'Score 92 — excellent architecture. 78 minutes of deep, 105 REM, only 12 awake. Overnight stress held at 11 and HR settled to 48bpm. Sleep debt is zero. The system is restored.',
    chips: [['SCORE', '92'], ['DEEP', '78m'], ['REM', '105m']],
  },
  training: {
    tone: 'positive', mood: 'transmit', meta: 'WEEK 4 · BUILD PHASE',
    line: 'Status holds Productive. Acute load is 505 — optimal, between 410 and 770. VO2max is 50.2 and computed fitness age is 19.3 years. Intensity minutes are light this week; today\'s treadmill session contributes to the build.',
    chips: [['STATUS', 'PRODUCTIVE'], ['LOAD', '505'], ['FIT AGE', '19.3']],
  },
};

// ── Real Garmin metrics ───────────────────────────────────────────────────
BACTA.metrics = {

  // ── RECOVERY ──────────────────────────────────────────────────────────
  recovery: {
    score: {
      value: 77, state: 'Ready',
      trend: [65, 70, 68, 72, 69, 74, 77],
    },
    hrv: {
      value: 66, unit: 'ms',
      weekAvg: 62, baselineLow: 56, baselineHigh: 71,
      // avg kept for Delta compat
      avg: 62,
      trend: [59, 61, 58, 63, 60, 64, 66],
    },
    battery: {
      // wake = body_battery_wake (reliable), current = body_battery_current
      wake: 100, current: 78, consumed: 22,
      // keep now/max/min aliases for BodyBattery component compat
      now: 78, max: 100, min: 78,
      trend: [88, 91, 85, 93, 87, 90, 100],
    },
    rhr: {
      value: 43, unit: 'bpm', avg: 45, lowerBetter: true,
      trend: [46, 45, 47, 44, 45, 44, 43],
    },
    stress: {
      avg: 11, max: 70, label: 'LOW',
      // keep value alias for VitalTile compat
      value: 11, unit: 'avg', lowerBetter: true,
      trend: [14, 12, 16, 11, 13, 10, 11],
    },
    resp: {
      avg: 13, max: 20, unit: 'br/min', lowerBetter: true,
      value: 13,
      trend: [14, 13, 14, 13, 14, 13, 13],
    },
    spo2: {
      value: 97, unit: '%',
      avg: 97,
      trend: [96, 97, 96, 97, 97, 96, 97],
    },
  },

  // ── SLEEP ─────────────────────────────────────────────────────────────
  sleep: {
    score: {
      value: 92, state: 'Excellent',
      trend: [78, 83, 76, 88, 84, 89, 92],
    },
    duration: {
      h: 7, m: 53, mins: 473,
      inBed: 497, inBedMins: 497,
      efficiency: 95, debt: 0,
      trend: [420, 448, 392, 461, 445, 458, 473],
    },
    stages: [
      { key: 'deep',  label: 'Deep',  mins: 78,  pct: 17, color: '#7c5cff',
        idealMin: 63,  idealMax: 112 },
      { key: 'light', label: 'Light', mins: 278, pct: 59, color: '#a78bfa',
        idealMin: 200, idealMax: 300 },
      { key: 'rem',   label: 'REM',   mins: 105, pct: 22, color: '#c4b5fd',
        idealMin: 90,  idealMax: 120 },
      { key: 'awake', label: 'Awake', mins: 12,  pct: 0,  color: '#56657a',
        idealMin: 0,   idealMax: 20 },
    ],
    vitals: {
      hr:     { value: 48, unit: 'bpm',    trend: [52, 50, 53, 49, 51, 49, 48] },
      resp:   { value: 14, unit: 'br/min', trend: [15, 14, 15, 14, 14, 14, 14] },
      stress: { value: 11,                 trend: [14, 12, 15, 11, 12, 11, 11] },
      spo2:   { avg: 98, unit: '%' },
    },
    // hypno is a stub (Garmin API does not expose per-epoch staging)
    hypno: [0, 2, 3, 3, 2, 1, 3, 3, 2, 1, 1, 2, 3, 2, 1, 0, 1, 2, 2, 1, 1, 2, 1, 0],
    // keep legacy compat fields
    spo2: { avg: 98, low: null, unit: '%' },
    resp: { avg: 14, unit: 'br/min' },
    sleepHr: 48, sleepStress: 11,
    sleepHrTrend: [52, 50, 53, 49, 51, 49, 48],
    sleepStressTrend: [14, 12, 15, 11, 12, 11, 11],
    sleepRespTrend: [15, 14, 15, 14, 14, 14, 14],
    deepRatio: 17, remRatio: 22,
    sleepDebt: 0,
  },

  // ── TRAINING ──────────────────────────────────────────────────────────
  training: {
    status: {
      value: 'Productive', sub: 'Week 4 · Build',
      trend: [5, 6, 7, 7, 7, 7, 7],
    },
    vo2max: {
      value: 50.2, unit: 'mL/kg/min', delta: 0,
      fitnessAge: 19.3,
      trend: [49.8, 49.9, 50.0, 50.0, 50.1, 50.2, 50.2],
    },
    load: {
      value: 505, low: 410, high: 770, state: 'Optimal',
      trend: [422, 458, 475, 491, 505, 498, 505],
    },
    intensity: {
      moderate: 14, vigorous: 29, goal: 150,
      trend: [0, 25, 14, 0, 14, 29, 43],
    },
    hrZones: [
      { zone: 1, label: 'Warm Up',   mins: 4.1,  color: '#56657a' },
      { zone: 2, label: 'Easy',      mins: 0.9,  color: '#4ade80' },
      { zone: 3, label: 'Aerobic',   mins: 14.3, color: '#fbbf24' },
      { zone: 4, label: 'Threshold', mins: 5.8,  color: '#f87171' },
      { zone: 5, label: 'Maximum',   mins: 0,    color: '#ef4444' },
    ],
    daily: {
      steps: 7137, stepGoal: 10000,
      distanceKm: 5.7,   distanceGoal: 8.0,
      caloriesTotal: 1294, calGoal: 2500,
      caloriesActive: 457, activeCalGoal: 600,
      floors: 1,          floorsGoal: 10,
      stepsTrend: [8420, 6213, 11250, 9340, 5890, 8750, 7137],
      calTrend:   [1820, 1650, 2100, 1950, 1580, 1940, 1294],
    },
    // keep dailyActivity alias for TrainingPage compat
    dailyActivity: {
      steps: 7137, distanceKm: 5.7,
      caloriesTotal: 1294, caloriesActive: 457, floors: 1,
      stepsTrend: [8420, 6213, 11250, 9340, 5890, 8750, 7137],
      calTrend:   [1820, 1650, 2100, 1950, 1580, 1940, 1294],
    },
    activities: [
      { type: 'Treadmill Run', typeKey: 'treadmill_running',
        dist: '3.9 km', dur: '30:10', kcal: 323, hr: 140,
        when: 'TODAY · 06:40', feel: 'Easy', sigil: 'run',
        trainingEffect: { aerobic: 3.2, anaerobic: 0.5 },
        recoveryTime: 22, benefit: 'BASE' },
      { type: 'Strength',      typeKey: 'strength_training',
        dist: null,    dur: '45:00', kcal: 280, hr: 95,
        when: 'MON · 17:20', feel: 'Upper', sigil: 'strength',
        trainingEffect: { aerobic: 1.0, anaerobic: 2.8 },
        recoveryTime: 18, benefit: 'STRENGTH' },
      { type: 'Yoga',          typeKey: 'yoga',
        dist: null,    dur: '60:00', kcal: 180, hr: 85,
        when: 'SUN · 08:00', feel: 'Flow', sigil: 'strength',
        trainingEffect: { aerobic: 0.5, anaerobic: 0.2 },
        recoveryTime: 4, benefit: 'RECOVERY' },
      { type: 'Trail Run',     typeKey: 'trail_running',
        dist: '8.5 km', dur: '52:30', kcal: 540, hr: 152,
        when: 'SAT · 07:05', feel: 'Tempo', sigil: 'run',
        trainingEffect: { aerobic: 4.1, anaerobic: 1.4 },
        recoveryTime: 38, benefit: 'TEMPO' },
    ],
    // keep endurance stub for any legacy refs
    endurance: { value: 71, state: 'Trained', trend: [64, 66, 65, 68, 69, 70, 71] },
  },
};

// ── Home tiles — real values ──────────────────────────────────────────────
BACTA.tiles = [
  { key: 'recovery', value: '77',  unit: 'score',
    sub: 'HRV 66ms · Battery 100%',
    viz: 'spark', spark: [65, 70, 68, 72, 69, 74, 77], status: 'Ready' },
  { key: 'training', value: '505', unit: 'load',
    sub: 'Productive · Fit Age 19',
    viz: 'spark', spark: [422, 458, 475, 491, 505, 498, 505], status: 'Optimal' },
  { key: 'sleep',    value: '7.9', unit: 'h',
    sub: 'Score 92 · Excellent',
    viz: 'ring',  ring: 0.92, status: 'Excellent' },
  { key: 'nutrition',value: '—',   unit: '',
    sub: 'MacroFactor offline',
    viz: 'ring',  ring: 0, status: 'Offline' },
  { key: 'bloodwork',value: '—',   unit: '',
    sub: 'No panels synced',
    viz: 'shield', status: 'Offline' },
  { key: 'dailylog', value: '0',   unit: '/ 5',
    sub: 'Nothing logged today',
    viz: 'dots',  dots: 0, status: 'Empty' },
];

BACTA.signals = [
  { key: 'recovery', headline: '77',      unit: 'score',
    sub: 'HRV 66ms · Battery 100%',
    state: 'Ready', tone: 'positive',
    trend: [65, 70, 68, 72, 69, 74, 77] },
  { key: 'sleep',    headline: '7h 53m',  unit: '',
    sub: 'Score 92 · Excellent',
    state: 'Excellent', tone: 'positive',
    trend: [420, 448, 392, 461, 445, 458, 473] },
  { key: 'training', headline: 'Productive', unit: '',
    sub: 'Load 505 · VO2 50.2',
    state: 'Build', tone: 'positive',
    trend: [422, 458, 475, 491, 505, 498, 505] },
];

BACTA.fmtDur = (mins) =>
  `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
