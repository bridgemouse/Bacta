export type SectionKey = 'home' | 'recovery' | 'training' | 'sleep' | 'nutrition' | 'bloodwork' | 'dailylog'

export const COLORS = {
  base: '#0f1117',
  surface: '#111827',
  surfaceElevated: '#1e2d3d',
  border: '#1e2d3d',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  mx4Green: '#4ade80',
  mx4Amber: '#fbbf24',
  mx4Red: '#f87171',
} as const

export const SECTION_ACCENTS: Record<SectionKey, string> = {
  home:      '#4ade80',
  recovery:  '#64b5f6',
  training:  '#fb923c',
  sleep:     '#a78bfa',
  nutrition: '#34d399',
  bloodwork: '#f87171',
  dailylog:  '#fbbf24',
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
