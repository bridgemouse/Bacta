import { Router } from 'express'
import db from '../db/client'
import { setSetting, getSetting } from '../lib/settings'
import { scheduleNightly } from '../lib/ai/scheduler'
import { testVaultConnection, resetVaultClient } from '../lib/ai/vaultClient'

const settingsRouter = Router()

settingsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as
    { key: string; value: string }[]

  const out: Record<string, string> = {}
  for (const row of rows) {
    if (row.key === 'ai_api_key' && row.value.length > 0) {
      out[row.key] = '••••' + row.value.slice(-4)
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
