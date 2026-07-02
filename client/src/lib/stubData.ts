// Stub data — same shape as the live Garmin API will produce.
// Replace individual fields with real API calls as sections are wired.

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const _today = new Date().getDay()
export const DAY = Array.from({ length: 7 }, (_, i) => DAY_ABBR[(_today - 6 + i + 7) % 7])

export type Tone = 'positive' | 'caution' | 'flag'
export type MX4Mood = 'transmit' | 'idle' | 'listen' | 'think' | 'alert' | 'pleased'

export interface Brief {
  tone: Tone
  mood: MX4Mood
  meta: string
  line: string
  chips: [string, string][]
}

export const BRIEFS: Record<string, Brief> = {
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
    line: 'Status holds at Productive — VO2max ticked to 52. Acute load is 342 and climbing toward the top of your optimal band. Today\'s run logged clean. Keep the next session aerobic to bank the adaptation.',
    chips: [['STATUS', 'PRODUCTIVE'], ['LOAD', '342'], ['VO2', '52']],
  },
}

// ── Recovery ──────────────────────────────────────────────────────────────────
export const RECOVERY = {
  score:   { value: 74, state: 'Ready',   trend: [62, 66, 60, 70, 68, 72, 74] },
  hrv:     { value: 61, unit: 'ms',  avg: 54, trend: [49, 53, 51, 56, 55, 58, 61] },
  battery: { now: 74,  max: 88,      min: 22, trend: [80, 84, 79, 88, 85, 86, 88] },
  rhr:     { value: 48, unit: 'bpm', avg: 50, trend: [52, 51, 50, 49, 50, 49, 48], lowerBetter: true },
  stress:  { value: 28, unit: 'avg', avg: 31, trend: [34, 30, 33, 28, 31, 27, 28], lowerBetter: true },
  spo2:    { value: 96, unit: '%',   avg: 96, trend: [95, 96, 95, 96, 96, 95, 96] },
  resp:    { value: 14, unit: 'br/min', avg: 14, trend: [15, 14, 15, 14, 14, 15, 14], lowerBetter: true },
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
export interface SleepStage {
  key: 'deep' | 'light' | 'rem' | 'awake'
  label: string
  mins: number
  pct: number
  color: string
}

export const SLEEP = {
  duration: { h: 8, m: 6, mins: 486, inBed: 500, trend: [432, 408, 474, 504, 456, 480, 486] },
  score:    { value: 82, state: 'Good', trend: [74, 70, 80, 85, 78, 81, 82] },
  stages: [
    { key: 'deep',  label: 'Deep',  mins: 87,  pct: 18, color: '#7c5cff' },
    { key: 'light', label: 'Light', mins: 277, pct: 57, color: '#a78bfa' },
    { key: 'rem',   label: 'REM',   mins: 122, pct: 25, color: '#c4b5fd' },
    { key: 'awake', label: 'Awake', mins: 14,  pct: 0,  color: '#56657a' },
  ] as SleepStage[],
  // overnight hypnogram — depth level per ~25 min block (0=awake, 1=rem, 2=light, 3=deep)
  hypno: [0, 2, 3, 3, 2, 1, 3, 3, 2, 1, 1, 2, 3, 2, 1, 0, 1, 2, 2, 1, 1, 2, 1, 0] as number[],
  spo2: { avg: 95, low: 91, unit: '%' },
  resp: { avg: 13, unit: 'br/min' },
}

// ── Training ──────────────────────────────────────────────────────────────────
export interface Activity {
  type: string
  sigil: 'run' | 'strength'
  dist: string | null
  dur: string
  kcal: number
  hr: number
  when: string
  feel: string
}

export const TRAINING = {
  status:    { value: 'Productive', sub: '', trend: [50, 50, 51, 51, 51, 52, 52] },
  vo2max:    { value: 52, unit: 'mL/kg/min', delta: +1, fitnessAge: 31 },
  load:      { value: 342, low: 280, high: 420, state: 'Optimal', trend: [280, 300, 260, 320, 340, 310, 342] },
  endurance: { value: 71, state: 'Trained', trend: [64, 66, 65, 68, 69, 70, 71] },
  intensity: { moderate: 210, vigorous: 75, goal: 150, trend: [22, 40, 0, 55, 30, 48, 60] },
  activities: [
    { type: 'Run',       sigil: 'run',      dist: '10.2 km', dur: '52:14', kcal: 612, hr: 148, when: 'TODAY · 06:40', feel: 'Aerobic' },
    { type: 'Strength',  sigil: 'strength', dist: null,      dur: '48:00', kcal: 320, hr: 112, when: 'SUN · 17:20',   feel: 'Upper' },
    { type: 'Trail Run', sigil: 'run',      dist: '8.5 km',  dur: '47:30', kcal: 540, hr: 152, when: 'SAT · 07:05',   feel: 'Tempo' },
  ] as Activity[],
}

// ── Home tile data (for System Card grid) ─────────────────────────────────────
export const HOME_TILES = [
  { key: 'recovery',  value: '74',    unit: 'battery', sub: 'HRV ↑ 61ms',           viz: 'spark',  spark: [50,54,49,57,55,60,66,74], status: 'Good' },
  { key: 'training',  value: '342',   unit: 'load',    sub: 'Moderate · wk 4 / 8',   viz: 'spark',  spark: [280,300,260,320,340,310,330,342], status: 'On track' },
  { key: 'sleep',     value: '8.1',   unit: 'h',       sub: 'Score 82',              viz: 'ring',   ring: 0.82, status: 'Solid' },
  { key: 'nutrition', value: '2,340', unit: 'kcal',    sub: 'Protein 142 / 160g',    viz: 'ring',   ring: 0.94, status: 'On target' },
  { key: 'bloodwork', value: 'Clear', unit: '',        sub: 'No flags · 0 panels',   viz: 'shield', status: 'Nominal' },
  { key: 'dailylog',  value: '4',     unit: '/ 5',     sub: 'Logged today',          viz: 'dots',   dots: 4, status: 'Logged' },
] as const

export const fmtDur = (mins: number) =>
  `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
