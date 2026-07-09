import { describe, it, expect, vi, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

let capturedFn: (() => void) | undefined
const scheduleMock = vi.fn((_expr: string, fn: () => void) => {
  capturedFn = fn
  return { stop: vi.fn() }
})
vi.mock('node-cron', () => ({
  default: { schedule: scheduleMock },
}))

vi.mock('../../server/api/integrations', () => ({
  runSync: vi.fn().mockResolvedValue(0),
}))

describe('scheduleProviderBackgroundSync', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('invokes runSync for an enabled non-Garmin provider on a scheduled tick', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_enabled', 'true')").run()

    const { runSync } = await import('../../server/api/integrations')
    vi.mocked(runSync).mockClear()

    const { scheduleProviderBackgroundSync } = await import('../../server/lib/providerSync')
    scheduleProviderBackgroundSync()

    expect(capturedFn).toBeDefined()
    capturedFn!()
    await new Promise(resolve => setImmediate(resolve))

    expect(runSync).toHaveBeenCalledWith('strava')
  })

  it('does not invoke runSync for a disabled provider', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('polar_enabled', 'false')").run()

    const { runSync } = await import('../../server/api/integrations')
    vi.mocked(runSync).mockClear()

    const { scheduleProviderBackgroundSync } = await import('../../server/lib/providerSync')
    scheduleProviderBackgroundSync()
    capturedFn!()
    await new Promise(resolve => setImmediate(resolve))

    expect(runSync).not.toHaveBeenCalledWith('polar')
  })

  it('never invokes runSync for garmin — that has its own dedicated scheduler', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('garmin_enabled', 'true')").run()

    const { runSync } = await import('../../server/api/integrations')
    vi.mocked(runSync).mockClear()

    const { scheduleProviderBackgroundSync } = await import('../../server/lib/providerSync')
    scheduleProviderBackgroundSync()
    capturedFn!()
    await new Promise(resolve => setImmediate(resolve))

    expect(runSync).not.toHaveBeenCalledWith('garmin')
  })

  it('does not start a second overlapping pass if a tick fires while the previous one is still in flight', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('strava_enabled', 'true')").run()

    const { runSync } = await import('../../server/api/integrations')
    vi.mocked(runSync).mockClear()
    let resolveFirstCall: (() => void) | undefined
    vi.mocked(runSync).mockImplementationOnce(() => new Promise(resolve => {
      resolveFirstCall = () => resolve(0)
    }))

    const { scheduleProviderBackgroundSync } = await import('../../server/lib/providerSync')
    scheduleProviderBackgroundSync()

    // First tick: runSync('strava') is now in flight (never resolves yet).
    capturedFn!()
    await new Promise(resolve => setImmediate(resolve))
    expect(runSync).toHaveBeenCalledTimes(1)

    // Second tick fires before the first has resolved — must not start a
    // second overlapping pass over the same providers.
    capturedFn!()
    await new Promise(resolve => setImmediate(resolve))
    expect(runSync).toHaveBeenCalledTimes(1)

    // Let the first call resolve and confirm a subsequent tick works normally.
    resolveFirstCall!()
    await new Promise(resolve => setImmediate(resolve))
    capturedFn!()
    await new Promise(resolve => setImmediate(resolve))
    expect(runSync).toHaveBeenCalledTimes(2)
  })
})
