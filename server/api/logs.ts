import { Router } from 'express'
import db from '../db/client'
import { logEvent } from '../lib/logger'

const logsRouter = Router()
const MAX_FIELD_LENGTH = 2000

const KNOWN_SOURCES = ['garmin', 'mx4', 'mx4-chat']
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

// GET /api/logs/sources — distinct sources available, including known sources
// with no entries yet so the UI switcher isn't empty on a fresh install
logsRouter.get('/sources', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT source FROM app_logs').all() as { source: string }[]
  const sources = Array.from(new Set([...KNOWN_SOURCES, ...rows.map(r => r.source)])).sort()
  res.json({ sources })
})

// GET /api/logs?source=<source>&limit=<n> — reverse-chronological log entries
logsRouter.get('/', (req, res) => {
  const { source } = req.query
  const limit = Math.min(Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT), MAX_LIMIT)

  const rows = typeof source === 'string' && source.length > 0
    ? db.prepare('SELECT source, level, message, created_at FROM app_logs WHERE source = ? ORDER BY id DESC LIMIT ?').all(source, limit)
    : db.prepare('SELECT source, level, message, created_at FROM app_logs ORDER BY id DESC LIMIT ?').all(limit)

  res.json({ logs: rows })
})

// POST /api/logs — client-side error reports (e.g. from ErrorBoundary), recorded as
// source 'client' so a crash is queryable here later instead of dead-ending at
// console.error on a tab that's about to reload (#183). Sits behind the same
// requireAuth gate as the rest of this router (applied at the app.use mount).
logsRouter.post('/', (req, res) => {
  const { message, componentStack } = req.body ?? {}
  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' })
    return
  }
  const detail = typeof componentStack === 'string' && componentStack.trim().length > 0
    ? `${message.slice(0, MAX_FIELD_LENGTH)} | stack: ${componentStack.slice(0, MAX_FIELD_LENGTH)}`
    : message.slice(0, MAX_FIELD_LENGTH)
  logEvent('client', 'error', detail)
  res.status(201).json({ ok: true })
})

export default logsRouter
