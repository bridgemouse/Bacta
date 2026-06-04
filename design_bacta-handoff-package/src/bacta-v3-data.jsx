/* bacta-v3-data.jsx — v3 data layer: new metrics, briefs, sections.
   Loads after bacta-data-v2.jsx. Patches BACTA in-place. */

// ── Recovery v3 ───────────────────────────────────────────────────────────

// Body Battery intraday curve (hourly: 22:00 prev night → ~10:00 today)
BACTA.metrics.recovery.bodyBatteryIntraday = {
  points: [
    { h: '22', v: 22 },
    { h: '23', v: 38 },
    { h: '00', v: 55 },
    { h: '01', v: 70 },
    { h: '02', v: 83 },
    { h: '03', v: 91 },
    { h: '04', v: 96 },
    { h: '05', v: 99 },
    { h: '06', v: 100, event: 'wake' },
    { h: '07', v: 90,  event: 'run' },
    { h: '08', v: 85 },
    { h: '09', v: 82 },
    { h: '10', v: 80 },
    { h: '11', v: 78 },
  ],
  wakeIdx:    8,   // index 8 = 06:00
  currentIdx: 13, // index 13 = 11:00 (now)
};

// HRV 7-day linear regression slope → directional label
BACTA.metrics.recovery.hrvDirection = {
  slope:     1.1,
  direction: 'up',
  label:     '↑ IMPROVING',
  sub:       '+1.1 ms/day',
};

// ── Training v3 ───────────────────────────────────────────────────────────

// Load Ratio (acute ÷ chronic)
const _acute   = BACTA.metrics.training.load.trend.reduce((s, v) => s + v, 0) / 7;
const _chronic = 460;
BACTA.metrics.training.loadRatio = {
  value:   Math.round((_acute / _chronic) * 100) / 100,
  acute:   Math.round(_acute),
  chronic: _chronic,
  state:   'Optimal',
};

// Fitness Age 30-day trend (downward = improving)
BACTA.metrics.training.fitnessAgeTrend = [
  21.2, 21.0, 20.8, 20.9, 20.6, 20.5, 20.3, 20.1, 20.0, 20.2,
  19.9, 19.7, 19.5, 19.3, 19.4, 19.2, 19.0, 19.1, 19.3, 19.0,
  18.8, 19.1, 18.9, 18.7, 18.8, 19.0, 18.9, 19.1, 19.0, 19.3,
];

// Weekly Training Volume — 6 weeks (hours)
BACTA.metrics.training.weeklyVolume = [
  { w: 'W48', h: 5.2 },
  { w: 'W49', h: 6.8 },
  { w: 'W50', h: 4.1 },
  { w: 'W51', h: 7.3 },
  { w: 'W52', h: 6.5 },
  { w: 'W1',  h: 2.3, current: true },
];

// Avg Activity HR by week — declining = aerobic improvement
BACTA.metrics.training.activityHrByWeek  = [148, 151, 145, 149, 147, 140];
BACTA.metrics.training.activityHrLabels  = ['W48', 'W49', 'W50', 'W51', 'W52', 'W1'];

// Per-activity details — patch existing activity objects
const _acts = BACTA.metrics.training.activities;
if (_acts[0]) {
  _acts[0].runDynamics = { cadence: 172, strideLength: 108, vertOscillation: 8.4, groundContact: 231 };
  _acts[0].activityHrZones = [
    { zone: 1, pct: 7,  color: '#56657a' },
    { zone: 2, pct: 14, color: '#4ade80' },
    { zone: 3, pct: 47, color: '#fbbf24' },
    { zone: 4, pct: 28, color: '#f87171' },
    { zone: 5, pct: 4,  color: '#ef4444' },
  ];
}
if (_acts[3]) {
  _acts[3].runDynamics = { cadence: 169, strideLength: 115, vertOscillation: 9.1, groundContact: 245 };
  _acts[3].activityHrZones = [
    { zone: 1, pct: 3,  color: '#56657a' },
    { zone: 2, pct: 8,  color: '#4ade80' },
    { zone: 3, pct: 28, color: '#fbbf24' },
    { zone: 4, pct: 42, color: '#f87171' },
    { zone: 5, pct: 19, color: '#ef4444' },
  ];
}

// floors_down
BACTA.metrics.training.daily.floorsDown = 1;

// ── Sleep v3 ──────────────────────────────────────────────────────────────

// Pre-computed architecture score: deep 17%, rem 22%, awake ~2.5%
// deep_score = 17/20 = 0.85 | rem_score = 22/22 = 1.0 | awake_score = 0.85
// → round((0.85×0.4 + 1.0×0.4 + 0.85×0.2) × 100) = 91
BACTA.metrics.sleep.architectureScore = 91;

// Sleep Consistency — 7-night bedtimes (minutes past midnight)
BACTA.metrics.sleep.consistency = {
  bedtimes:    [1350, 1380, 1410, 1330, 1365, 1350, 1340],
  labels:      ['Tu', 'We', 'Th', 'Fr', 'Sa', 'Su', 'Mo'],
  stdDev:      26,
  status:      'MODERATE',
  statusColor: '#fbbf24',
  avgLabel:    '22:41',
};

// ── Daily Log ─────────────────────────────────────────────────────────────

BACTA.metrics.dailylog = {
  date: 'TUE · JUN 3',
  // Initial logged values — null = not yet logged today
  behaviors: {
    caffeine:    200,
    caffeineTime: '09:00',
    alcohol:     0,
    preworkout:  false,
    screens:     null,
    lateMeal:    false,
    stressEvent: null,
    bedtime:     null,
    dietQuality: 4,
    water:       null,
    supplements: ['Omega-3', 'Magnesium', 'Creatine'],
    readiness:   4,
    mood:        'Good',
  },
};

BACTA.brief.dailylog = {
  tone: 'positive', mood: 'think', meta: 'JUN 3 · 10:22',
  line: 'Pattern found: on your 4 highest-HRV nights (≥62ms) you logged zero alcohol and took magnesium. Yesterday\'s 66ms reading supports it. Maintain the combination — 7 straight nights is enough for statistical confidence.',
  chips: [['PATTERN', '4 NIGHTS'], ['HRV DELTA', '+12ms'], ['KEY', 'SUPPLEMENTS']],
};

// ── Blood Work ────────────────────────────────────────────────────────────

BACTA.brief.bloodwork = {
  tone: 'positive', mood: 'pleased', meta: 'PANEL · MAR 15 · 2026',
  line: 'All 23 markers within range. No flags. Testosterone sits in the upper third of normal — consistent with your fitness age of 19.3. CRP at 0.4 confirms minimal systemic inflammation. Next panel in September.',
  chips: [['MARKERS', '23/23'], ['FLAGS', '0'], ['NEXT', 'SEP 2026']],
};

BACTA.metrics.bloodwork = {
  lastUpdated: 'MAR 15, 2026',
  panels: [
    {
      id: 'hormones', label: 'HORMONES', flags: 0,
      markers: [
        { name: 'Testosterone',       val: 742,  unit: 'ng/dL',  lo: 300,  hi: 1000, dp: 0 },
        { name: 'Free Testosterone',  val: 18.4, unit: 'pg/mL',  lo: 8.7,  hi: 25.1, dp: 1 },
        { name: 'Estradiol',          val: 22,   unit: 'pg/mL',  lo: 10,   hi: 50,   dp: 0 },
        { name: 'DHEA-S',             val: 285,  unit: 'µg/dL',  lo: 160,  hi: 449,  dp: 0 },
        { name: 'LH',                 val: 4.8,  unit: 'mIU/mL', lo: 1.5,  hi: 9.3,  dp: 1 },
      ],
    },
    {
      id: 'thyroid', label: 'THYROID', flags: 0,
      markers: [
        { name: 'TSH',     val: 1.8, unit: 'mIU/L', lo: 0.4, hi: 4.0, dp: 1 },
        { name: 'Free T3', val: 3.2, unit: 'pg/mL', lo: 2.3, hi: 4.2, dp: 1 },
        { name: 'Free T4', val: 1.2, unit: 'ng/dL', lo: 0.8, hi: 1.8, dp: 1 },
      ],
    },
    {
      id: 'metabolic', label: 'METABOLIC', flags: 0,
      markers: [
        { name: 'HbA1c',           val: 5.1, unit: '%',      lo: 0,  hi: 5.7, dp: 1 },
        { name: 'Fasting Glucose', val: 88,  unit: 'mg/dL',  lo: 70, hi: 99,  dp: 0 },
        { name: 'Insulin',         val: 4.2, unit: 'µIU/mL', lo: 2,  hi: 25,  dp: 1 },
        { name: 'hs-CRP',          val: 0.4, unit: 'mg/L',   lo: 0,  hi: 3.0, dp: 1 },
      ],
    },
    {
      id: 'lipids', label: 'LIPIDS', flags: 0,
      markers: [
        { name: 'Total Cholesterol', val: 168, unit: 'mg/dL', lo: 0,  hi: 200, dp: 0 },
        { name: 'LDL',               val: 95,  unit: 'mg/dL', lo: 0,  hi: 100, dp: 0 },
        { name: 'HDL',               val: 58,  unit: 'mg/dL', lo: 40, hi: 999, dp: 0 },
        { name: 'Triglycerides',     val: 72,  unit: 'mg/dL', lo: 0,  hi: 150, dp: 0 },
        { name: 'Non-HDL Chol',      val: 110, unit: 'mg/dL', lo: 0,  hi: 130, dp: 0 },
      ],
    },
    {
      id: 'vitamins', label: 'IRON · VITAMINS', flags: 0,
      markers: [
        { name: 'Ferritin',  val: 89,  unit: 'ng/mL', lo: 24,  hi: 336, dp: 0 },
        { name: 'Vitamin D', val: 52,  unit: 'ng/mL', lo: 30,  hi: 100, dp: 0 },
        { name: 'B12',       val: 612, unit: 'pg/mL', lo: 200, hi: 900, dp: 0 },
        { name: 'Folate',    val: 18,  unit: 'ng/mL', lo: 5.4, hi: 50,  dp: 0 },
      ],
    },
    {
      id: 'cbc', label: 'CBC', flags: 0,
      markers: [
        { name: 'RBC',        val: 5.1,  unit: 'M/µL', lo: 4.7,  hi: 6.1,  dp: 1 },
        { name: 'WBC',        val: 5.8,  unit: 'K/µL', lo: 4.0,  hi: 10.5, dp: 1 },
        { name: 'Hemoglobin', val: 15.8, unit: 'g/dL', lo: 13.5, hi: 17.5, dp: 1 },
        { name: 'Hematocrit', val: 47.2, unit: '%',    lo: 41,   hi: 53,   dp: 1 },
        { name: 'Platelets',  val: 218,  unit: 'K/µL', lo: 150,  hi: 400,  dp: 0 },
      ],
    },
  ],
};

// Peak stress 7-day trend for Recovery sparkline
BACTA.metrics.recovery.stress.maxTrend = [55, 62, 70, 48, 65, 58, 70];

// SpO₂ nightly trend for Sleep sparkline
if (!BACTA.metrics.sleep.vitals.spo2.trend) {
  BACTA.metrics.sleep.vitals.spo2.trend = [97, 98, 97, 98, 98, 97, 98];
}

// Rename bloodwork section label to Labs
if (BACTA.section && BACTA.section.bloodwork) {
  BACTA.section.bloodwork.label = 'Labs';
}

// Fix sleep tile — ring already shows 92 (score), sub was duplicating it
const _slpTile = BACTA.tiles.find(t => t.key === 'sleep');
if (_slpTile) {
  _slpTile.value = '7h 53m';
  _slpTile.unit  = '';
  _slpTile.sub   = 'Excellent';
}

// ── Card Size System ──────────────────────────────────────────────────────
// 6-tier grid foundation for modular card layout.
// minHeight ensures baseline; cards can grow but never shrink below tier.
BACTA.CARD_SIZES = {
  hero:  220,   // Score gauges + narrative (full width)
  chart: 170,   // Full chart cards — HRV band, Body Battery arc, Architecture
  bar:   140,   // Bar chart cards — 7-day steps, load trend, weekly volume
  pair:  110,   // Half-width paired cards — HeadlineCards, Efficiency/Debt
  tile:   88,   // 2×2 quarter tiles — vitals, activity metrics
  row:    52,   // Compact rows — TrendRows, IntensityBar
};

// Remove the background grid/checker texture
window.bactaTexture = () => ({});

// Update tiles to reflect live dailylog + bloodwork
const _dlTile = BACTA.tiles.find(t => t.key === 'dailylog');
if (_dlTile) {
  Object.assign(_dlTile, { value: '7', unit: '/ 12', sub: '3 categories logged', dots: 7, status: 'Active' });
}
const _bwTile = BACTA.tiles.find(t => t.key === 'bloodwork');
if (_bwTile) {
  Object.assign(_bwTile, { value: '23', unit: 'markers', sub: 'All in range · 0 flags', status: 'Clean' });
}
