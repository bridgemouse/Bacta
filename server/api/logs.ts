import { Router } from 'express'
import db from '../db/client'

const logsRouter = Router()

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

export default logsRouter
