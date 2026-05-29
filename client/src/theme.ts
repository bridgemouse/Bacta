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
  mx4Green:        '#4ade80',
  mx4Amber:        '#fbbf24',
  mx4Red:          '#f87171',
} as const

export const SECTION_ACCENTS: Record<SectionKey, string> = {
  home:      '#4ade80',
  recovery:  '#7c9af8',
  training:  '#f5853a',
  sleep:     '#b08cf0',
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
