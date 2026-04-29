// server/api/azi3.ts
import { Router } from 'express'
import fs from 'fs'

const router = Router()

router.post('/run', (_req, res) => {
  const signalPath = process.env.AZI3_SIGNAL_PATH ?? './data/azi3_run_signal'
  fs.writeFileSync(signalPath, new Date().toISOString())
  res.status(202).json({ ok: true })
})

export default router
