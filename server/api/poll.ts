import { Router } from 'express'
import { spawn } from 'child_process'
import path from 'path'
import { logEvent } from '../lib/logger'

const pollRouter = Router()

let polling = false

// POST /api/poll/force — force an immediate Garmin data poll by running the
// poller. (Previously wrote an orphaned signal file that nothing consumed; the
// legacy check_signal.py watcher spawned the deprecated Python orchestrator.)
pollRouter.post('/force', (_req, res) => {
  if (polling) {
    res.status(202).json({ ok: true, status: 'running' })
    return
  }
  const script = path.join(process.cwd(), 'scripts', 'garmin_poller.py')
  polling = true
  const child = spawn('python3', [script], { stdio: 'ignore' })
  child.on('close', (code) => {
    polling = false
    if (code !== 0) logEvent('garmin', 'error', `Force sync failed (exit code ${code})`)
  })
  child.on('error', (err) => {
    polling = false
    logEvent('garmin', 'error', `Force sync failed to spawn: ${err.message}`)
  })
  res.status(202).json({ ok: true, status: 'running' })
})

export default pollRouter
