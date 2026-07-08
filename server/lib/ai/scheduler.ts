import cron, { type ScheduledTask } from 'node-cron'
import { getSetting } from '../settings'
import { runOrchestrator } from './orchestrator'
import { logEvent } from '../logger'

let nightlyTask: ScheduledTask | null = null

export function scheduleNightly(): void {
  if (nightlyTask) {
    nightlyTask.stop()
    nightlyTask = null
  }

  const enabled = getSetting('mx4_nightly_enabled')
  if (enabled !== 'true') {
    console.log('[mx4] nightly run disabled')
    return
  }

  const time = getSetting('mx4_nightly_time') ?? '04:00'
  const [hour, minute] = time.split(':')
  const expr = `${minute} ${hour} * * *`

  nightlyTask = cron.schedule(expr, () => {
    runOrchestrator().catch(err => {
      console.error('[mx4] nightly run error:', err)
      const message = err instanceof Error ? err.message : String(err)
      logEvent('mx4', 'error', `Nightly run failed: ${message}`)
    })
  })

  console.log(`[mx4] nightly run scheduled at ${time} (cron: ${expr})`)
}
