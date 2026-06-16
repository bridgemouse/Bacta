import db from '../db/client'

export const SETTING_DEFAULTS: Record<string, string> = {
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
  vault_enabled: 'false',
  vault_url:     '',
  research_provider: 'none',  // none | tavily | exa — scholarly backend is always on
  research_api_key:  '',      // optional key for the web backend (masked)
}

// Keys whose values must never be returned to the client in cleartext.
export const SECRET_SETTING_KEYS = new Set(['ai_api_key', 'research_api_key'])

export function initSettings(): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
  )
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
