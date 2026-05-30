import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const mx4Router = Router()

const DEFAULT_SIGNAL_PATH = path.join(process.cwd(), 'data', 'mx4_signal')

// POST /api/mx4/run — write a signal file to trigger an MX-4 / MX-4 run
mx4Router.post('/run', (_req, res) => {
  const signalPath = process.env.MX4_SIGNAL_PATH ?? DEFAULT_SIGNAL_PATH
  fs.mkdirSync(path.dirname(signalPath), { recursive: true })
  fs.writeFileSync(signalPath, new Date().toISOString())
  res.status(202).json({ ok: true })
})

export default mx4Router
