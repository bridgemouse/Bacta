export type SectionKey = 'home' | 'recovery' | 'training' | 'sleep' | 'nutrition' | 'bloodwork' | 'dailylog'

export const MX4_COLOR = '#2bc4e8'   // bacta-cyan — MX-4 identity

export const COLORS = {
  base:            '#0f1117',
  surface:         '#111827',
  surfaceElevated: '#1e2d3d',
  border:          '#1e2d3d',
  line:            '#27384a',
  text:            '#f4f7fb',
  textSecondary:   '#94a3b8',
  textMuted:       '#56657a',
  green:           '#4ade80',   // tone: positive
  amber:           '#fbbf24',   // tone: caution
  red:             '#f87171',   // tone: flag
  mx4Green:        '#4ade80',
  mx4Amber:        '#fbbf24',
  mx4Red:          '#f87171',
} as const

export const SECTION_ACCENTS: Record<SectionKey, string> = {
  home:      MX4_COLOR,   // home wears MX-4 cyan, not green
  recovery:  '#64b5f6',
  training:  '#fb923c',
  sleep:     '#a78bfa',
  nutrition: '#3ecf8e',
  bloodwork: '#ef6f6c',
  dailylog:  '#f5cf5e',
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  home:      'Home',
  recovery:  'Recovery',
  training:  'Training',
  sleep:     'Sleep',
  nutrition: 'Nutrition',
  bloodwork: 'Blood Work',
  dailylog:  'Daily Log',
}

export const SECTION_ICONS: Record<SectionKey, string> = {
  home:      '🏠',
  recovery:  '🔋',
  training:  '💪',
  sleep:     '😴',
  nutrition: '🥗',
  bloodwork: '🩸',
  dailylog:  '📋',
}

export const FONT_UI   = "'Hanken Grotesk', system-ui, sans-serif"
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"

export type Tone = 'positive' | 'caution' | 'flag'
export const toneColor = (t: Tone): string =>
  t === 'flag' ? COLORS.red : t === 'caution' ? COLORS.amber : COLORS.green

/** Sections that have full Overview + Trends content built */
export const BUILT_SECTIONS: SectionKey[] = ['home', 'recovery', 'sleep', 'training']

export const CARD_SIZES = {
  hero:  220,
  chart: 170,
  bar:   140,
  pair:  110,
  tile:   88,
  row:    52,
} as const
export type CardSize = keyof typeof CARD_SIZES

export interface CardInfo {
  description: string
  title?: string
  source?: string
}
