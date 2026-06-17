import { Router } from 'express'
import { spawn } from 'child_process'
import path from 'path'

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
  child.on('close', () => { polling = false })
  child.on('error', () => { polling = false })
  res.status(202).json({ ok: true, status: 'running' })
})

export default pollRouter
