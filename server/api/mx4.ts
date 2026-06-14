import { Router } from 'express'
import { runOrchestrator } from '../lib/ai/orchestrator'

const mx4Router = Router()

mx4Router.post('/run', (_req, res) => {
  res.status(202).json({ ok: true })
  setImmediate(() => {
    runOrchestrator().catch(err => console.error('[mx4] manual run error:', err))
  })
})

export default mx4Router
