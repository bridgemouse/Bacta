import cron, { type ScheduledTask } from 'node-cron'
import { getSetting, setSetting, PROVIDERS } from './settings'
import { runSync } from '../api/integrations'
import { logEvent } from './logger'

// Garmin has its own dedicated, user-configurable scheduler (garminSync.ts) —
// this covers the 6 OAuth/API-key providers, which previously only synced on
// a manual "SYNC NOW" click.
const SYNC_INTERVAL_CRON = '0 * * * *' // hourly

async function syncEnabledProviders(): Promise<void> {
  for (const provider of PROVIDERS) {
    if (provider === 'garmin') continue
    if (getSetting(`${provider}_enabled`) !== 'true') continue
    try {
      await runSync(provider)
      setSetting(`${provider}_last_sync`, new Date().toISOString())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logEvent('integrations', 'error', `${provider} background sync failed: ${message}`)
    }
  }
}

let backgroundTask: ScheduledTask | null = null

export function scheduleProviderBackgroundSync(): void {
  if (backgroundTask) {
    backgroundTask.stop()
    backgroundTask = null
  }
  backgroundTask = cron.schedule(SYNC_INTERVAL_CRON, () => { syncEnabledProviders() })
  console.log(`[integrations] provider background sync scheduled (cron: ${SYNC_INTERVAL_CRON})`)
}
