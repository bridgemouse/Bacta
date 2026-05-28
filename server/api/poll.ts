import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const pollRouter = Router()

const DEFAULT_SIGNAL_PATH = path.join(process.cwd(), 'data', 'poll_signal')

// POST /api/poll/force — write a signal file to trigger a manual data poll
pollRouter.post('/force', (_req, res) => {
  const signalPath = process.env.POLL_SIGNAL_PATH ?? DEFAULT_SIGNAL_PATH
  fs.mkdirSync(path.dirname(signalPath), { recursive: true })
  fs.writeFileSync(signalPath, new Date().toISOString())
  res.status(202).json({ ok: true })
})

export default pollRouter
