import { Router } from 'express'
import fs from 'fs'

const router = Router()

router.post('/force', (_req, res) => {
  const signalPath = process.env.POLL_SIGNAL_PATH ?? './data/poll_signal'
  fs.writeFileSync(signalPath, new Date().toISOString())
  res.status(202).json({ message: 'poll signal sent' })
})

export default router
