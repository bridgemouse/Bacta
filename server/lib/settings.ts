import db from '../db/client'

export const PROVIDERS = ['strava', 'hevy', 'polar', 'oura', 'whoop', 'withings'] as const
export type Provider = typeof PROVIDERS[number]

export const SETTING_DEFAULTS: Record<string, string> = {
  // AI / MX-4
  ai_provider:                    'google',
  ai_api_key:                     '',
  mx4_briefing_model:             'gemini-2.5-flash',
  mx4_chat_model:                 'gemini-2.5-flash',
  mx4_nightly_enabled:            'true',
  mx4_nightly_time:               '04:00',
  mx4_on_sync_enabled:            'true',
  mx4_chat_compression_threshold: '20',
  mx4_home_rerun_mode:            'home_only',
  mx4_custom_skills:              JSON.stringify([{
    label:  'SYNC WIKI',
    prompt: 'Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving.',
  }]),
  vault_enabled:     'false',
  vault_url:         '',
  research_provider: 'none',
  research_api_key:  '',
  app_logo:          'splash',

  // Multi-device globals
  base_url:        'http://bacta.home',
  source_priority: JSON.stringify(['garmin']),

  // Strava
  strava_client_id:   '', strava_client_secret: '', strava_tokens: '',
  strava_enabled:     'false', strava_last_sync: '', strava_oauth_state: '',

  // Hevy
  hevy_api_key:   '', hevy_enabled: 'false', hevy_last_sync: '',

  // Polar
  polar_client_id:    '', polar_client_secret: '', polar_tokens: '',
  polar_enabled:      'false', polar_last_sync: '', polar_oauth_state: '',

  // Oura
  oura_client_id:     '', oura_client_secret: '', oura_tokens: '',
  oura_enabled:       'false', oura_last_sync: '', oura_oauth_state: '',

  // Whoop
  whoop_client_id:    '', whoop_client_secret: '', whoop_tokens: '',
  whoop_enabled:      'false', whoop_last_sync: '', whoop_oauth_state: '',

  // Withings
  withings_client_id: '', withings_client_secret: '', withings_tokens: '',
  withings_enabled:   'false', withings_last_sync: '', withings_oauth_state: '',
}

// Keys whose values must never be returned to the client in cleartext.
export const SECRET_SETTING_KEYS = new Set([
  'ai_api_key', 'research_api_key',
  'strava_client_secret', 'strava_tokens',   'strava_oauth_state',
  'hevy_api_key',
  'polar_client_secret',   'polar_tokens',   'polar_oauth_state',
  'oura_client_secret',    'oura_tokens',    'oura_oauth_state',
  'whoop_client_secret',   'whoop_tokens',   'whoop_oauth_state',
  'withings_client_secret','withings_tokens', 'withings_oauth_state',
])

export function initSettings(): void {
  const insert = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    insert.run(key, value)
  }
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
    .run(key, value)
}
