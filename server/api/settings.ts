import { Router } from 'express'
import db from '../db/client'
import { setSetting, getSetting, SETTING_DEFAULTS, SECRET_SETTING_KEYS } from '../lib/settings'
import { scheduleNightly } from '../lib/ai/scheduler'
import { testVaultConnection, resetVaultClient } from '../lib/ai/vaultClient'

const settingsRouter = Router()

// Per-key value validators. Only keys present here may be written via the API;
// anything else (including auth_* secrets) is rejected.
const SETTING_VALIDATORS: Record<string, (v: string) => boolean> = {
  ai_provider:        v => ['google', 'anthropic', 'openai'].includes(v),
  ai_api_key:         v => v.length <= 400,
  research_provider:  v => ['none', 'tavily', 'exa'].includes(v),
  research_api_key:   v => v.length <= 400,
  mx4_briefing_model: v => /^[\w.\-:]{1,60}$/.test(v),
  mx4_chat_model:     v => /^[\w.\-:]{1,60}$/.test(v),
  mx4_nightly_enabled: v => v === 'true' || v === 'false',
  mx4_on_sync_enabled: v => v === 'true' || v === 'false',
  vault_enabled:       v => v === 'true' || v === 'false',
  mx4_nightly_time:   v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
  mx4_chat_compression_threshold: v => /^\d{1,3}$/.test(v) && +v >= 4 && +v <= 200,
  mx4_home_rerun_mode: v => ['home_only', 'all_sections'].includes(v),
  mx4_custom_skills:   v => { try { return Array.isArray(JSON.parse(v)) } catch { return false } },
  vault_url:           v => v === '' || /^https?:\/\/[^\s]+$/.test(v),
  app_logo:            v => ['capsule','splash','splat','crown','bloom','orb','vortex'].includes(v),
}

settingsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as
    { key: string; value: string }[]

  const out: Record<string, string> = {}
  for (const row of rows) {
    // Never expose auth secrets or unknown internal keys via the settings API.
    if (row.key.startsWith('auth_')) continue
    if (SECRET_SETTING_KEYS.has(row.key)) {
      out[row.key] = row.value.length > 0 ? '••••' + row.value.slice(-4) : ''
    } else {
      out[row.key] = row.value
    }
  }
  res.json(out)
})

settingsRouter.post('/test-connection', async (_req, res) => {
  try {
    // lazy import so we don't force server startup to fail if provider isn't configured
    const { testConnection } = await import('../lib/ai/provider')
    const result = await testConnection()
    res.json(result)
  } catch {
    res.json({ ok: false, error: 'Provider not configured' })
  }
})

settingsRouter.post('/test-vault-connection', async (_req, res) => {
  const result = await testVaultConnection()
  res.json(result)
})

settingsRouter.get('/custom-skills', (_req, res) => {
  const raw = getSetting('mx4_custom_skills')
  try {
    const skills = raw ? JSON.parse(raw) : []
    res.json({ skills })
  } catch {
    res.json({ skills: [] })
  }
})

settingsRouter.put('/:key', (req, res) => {
  const { key } = req.params
  const { value } = req.body
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value must be a string' })
  }
  const validate = SETTING_VALIDATORS[key]
  if (!validate || !(key in SETTING_DEFAULTS)) {
    return res.status(400).json({ error: 'unknown setting key' })
  }
  if (!validate(value)) {
    return res.status(400).json({ error: 'invalid value for ' + key })
  }
  setSetting(key, value)
  if (key === 'mx4_nightly_time' || key === 'mx4_nightly_enabled') {
    scheduleNightly()
  }
  if (key === 'vault_enabled' || key === 'vault_url') {
    resetVaultClient()
  }
  res.json({ ok: true })
})

export default settingsRouter
