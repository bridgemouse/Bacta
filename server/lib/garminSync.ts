import { spawn } from 'child_process'
import path from 'path'
import cron, { type ScheduledTask } from 'node-cron'
import { getSetting } from './settings'

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
  const child = spawn('python3', [script], { stdio: 'ignore' })
  child.on('close', (code) => {
    syncStatus = code === 0 ? 'done' : 'error'
    // Auto-reset to idle after 90s so the button returns to ready state
    setTimeout(() => { syncStatus = 'idle'; syncStartedAt = null }, 90_000)
  })
  return { ok: true, status: 'running' }
}

// 0 = background sync disabled. Nonzero values are floored to a 15-minute
// minimum so the poller can't be scheduled to hammer the Garmin API.
export function clampSyncInterval(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.max(MIN_INTERVAL_MINUTES, Math.round(minutes))
}

export function buildSyncCronExpr(minutes: number): string {
  return `*/${minutes} * * * *`
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
