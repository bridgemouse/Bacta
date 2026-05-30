import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const azi3Router = Router()

const DEFAULT_SIGNAL_PATH = path.join(process.cwd(), 'data', 'azi3_signal')

// POST /api/azi3/run — write a signal file to trigger an MX-4 / AZI-3 run
azi3Router.post('/run', (_req, res) => {
  const signalPath = process.env.AZI3_SIGNAL_PATH ?? DEFAULT_SIGNAL_PATH
  fs.mkdirSync(path.dirname(signalPath), { recursive: true })
  fs.writeFileSync(signalPath, new Date().toISOString())
  res.status(202).json({ ok: true })
})

export default azi3Router
