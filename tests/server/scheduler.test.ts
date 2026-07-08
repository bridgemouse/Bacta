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

vi.mock('../../server/lib/ai/orchestrator', () => ({
  runOrchestrator: vi.fn(),
}))

describe('scheduleNightly', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mx4_nightly_enabled', 'true')").run()
  })

  it('logs a failure to app_logs when runOrchestrator rejects outright', async () => {
    const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
    vi.mocked(runOrchestrator).mockRejectedValueOnce(new Error('loadHeartbeat ENOENT'))

    const { scheduleNightly } = await import('../../server/lib/ai/scheduler')
    scheduleNightly()

    expect(capturedFn).toBeDefined()
    capturedFn!()
    // The failure is handled via .catch on a fire-and-forget promise — flush
    // the microtask queue so the rejection has a chance to be logged.
    await new Promise(resolve => setImmediate(resolve))

    const { default: db } = await import('../../server/db/client')
    const row = db.prepare(
      "SELECT level, message FROM app_logs WHERE source = 'mx4' AND message LIKE '%nightly%' ORDER BY id DESC LIMIT 1"
    ).get() as { level: string; message: string } | undefined
    expect(row).toBeDefined()
    expect(row!.level).toBe('error')
    expect(row!.message).toContain('loadHeartbeat ENOENT')
  })
})
