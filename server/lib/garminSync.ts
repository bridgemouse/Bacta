import { spawn } from 'child_process'
import path from 'path'
import cron, { type ScheduledTask } from 'node-cron'
import { getSetting } from './settings'
import { logEvent } from './logger'

export type SyncStatus = 'idle' | 'running' | 'done' | 'error'

const MIN_INTERVAL_MINUTES = 15

let syncStatus: SyncStatus = 'idle'
let syncStartedAt: number | null = null

export function getSyncState(): { status: SyncStatus; elapsed: number | null } {
  const elapsed = syncStartedAt != null ? Math.round((Date.now() - syncStartedAt) / 1000) : null
  return { status: syncStatus, elapsed }
}

export function triggerGarminSync(): { ok: boolean; status: SyncStatus } {
  if (syncStatus === 'running') {
    return { ok: true, status: 'running' }
  }
  const script = path.join(process.cwd(), 'scripts', 'garmin_poller.py')
  syncStatus = 'running'
  syncStartedAt = Date.now()
  logEvent('garmin', 'info', 'Sync triggered')
  const child = spawn('python3', [script], { stdio: 'ignore' })
  child.on('close', (code) => {
    syncStatus = code === 0 ? 'done' : 'error'
    logEvent('garmin', code === 0 ? 'info' : 'error',
      code === 0 ? 'Sync completed successfully' : `Sync failed (exit code ${code})`)
    // Auto-reset to idle after 90s so the button returns to ready state
    setTimeout(() => { syncStatus = 'idle'; syncStartedAt = null }, 90_000)
  })
  return { ok: true, status: 'running' }
}

const MAX_INTERVAL_MINUTES = 1440 // 24h — keeps buildSyncCronExpr's hour branch within cron's 0-23 hour field

// 0 = background sync disabled. Nonzero values are floored to a 15-minute
// minimum so the poller can't be scheduled to hammer the Garmin API, and
// capped at 24h so buildSyncCronExpr's hour-field step stays representable.
export function clampSyncInterval(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(minutes)))
}

// Cron's minute field only spans 0-59, so `*/N` silently collapses to a
// single match (fires every hour) for any N >= 60. Switch to the hour field
// once the interval reaches an hour so it's actually representable.
export function buildSyncCronExpr(minutes: number): string {
  if (minutes < 60) return `*/${minutes} * * * *`
  const hours = Math.max(1, Math.round(minutes / 60))
  return `0 */${hours} * * *`
}

let backgroundTask: ScheduledTask | null = null

export function scheduleGarminBackgroundSync(): void {
  if (backgroundTask) {
    backgroundTask.stop()
    backgroundTask = null
  }

  const raw = Number(getSetting('garmin_background_sync_min') ?? '60')
  const minutes = clampSyncInterval(raw)
  if (minutes === 0) {
    console.log('[garmin] background sync disabled')
    return
  }

  const expr = buildSyncCronExpr(minutes)
  backgroundTask = cron.schedule(expr, () => triggerGarminSync())
  console.log(`[garmin] background sync scheduled every ${minutes}min (cron: ${expr})`)
}
