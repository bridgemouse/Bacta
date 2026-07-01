import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

process.env.DB_PATH = ':memory:'

const spawnMock = vi.fn(() => {
  const child = new EventEmitter() as any
  setImmediate(() => child.emit('close', 0))
  return child
})
vi.mock('child_process', () => ({ spawn: spawnMock }))

describe('clampSyncInterval', () => {
  it('passes through a valid interval unchanged', async () => {
    const { clampSyncInterval } = await import('../../server/lib/garminSync')
    expect(clampSyncInterval(60)).toBe(60)
  })

  it('enforces a 15-minute minimum for nonzero values', async () => {
    const { clampSyncInterval } = await import('../../server/lib/garminSync')
    expect(clampSyncInterval(5)).toBe(15)
  })

  it('treats 0 as disabled', async () => {
    const { clampSyncInterval } = await import('../../server/lib/garminSync')
    expect(clampSyncInterval(0)).toBe(0)
  })

  it('treats negative values as disabled', async () => {
    const { clampSyncInterval } = await import('../../server/lib/garminSync')
    expect(clampSyncInterval(-10)).toBe(0)
  })

  it('treats NaN as disabled', async () => {
    const { clampSyncInterval } = await import('../../server/lib/garminSync')
    expect(clampSyncInterval(NaN)).toBe(0)
  })

  it('rounds fractional minutes', async () => {
    const { clampSyncInterval } = await import('../../server/lib/garminSync')
    expect(clampSyncInterval(45.6)).toBe(46)
  })

  it('caps values at 24h so the cron hour field stays representable', async () => {
    const { clampSyncInterval } = await import('../../server/lib/garminSync')
    expect(clampSyncInterval(999999)).toBe(1440)
  })
})

describe('buildSyncCronExpr', () => {
  it('builds an every-N-minutes cron expression for sub-hour intervals', async () => {
    const { buildSyncCronExpr } = await import('../../server/lib/garminSync')
    expect(buildSyncCronExpr(30)).toBe('*/30 * * * *')
  })

  it('uses the hour field for intervals of an hour or more', async () => {
    // Bug: `*/120 * * * *` is not representable in cron's 0-59 minute field —
    // node-cron expands '*' to '0-59' first, so a step of 120 collapses to
    // just minute 0, silently firing every hour instead of every 2 hours.
    const { buildSyncCronExpr } = await import('../../server/lib/garminSync')
    expect(buildSyncCronExpr(60)).toBe('0 */1 * * *')
    expect(buildSyncCronExpr(120)).toBe('0 */2 * * *')
    expect(buildSyncCronExpr(240)).toBe('0 */4 * * *')
  })
})

describe('triggerGarminSync', () => {
  beforeEach(() => {
    spawnMock.mockClear()
  })

  it('spawns the Garmin poller', async () => {
    const { triggerGarminSync } = await import('../../server/lib/garminSync')
    const result = triggerGarminSync()
    expect(result).toEqual({ ok: true, status: 'running' })
    expect(spawnMock).toHaveBeenCalledWith('python3', [expect.stringContaining('garmin_poller.py')], { stdio: 'ignore' })
  })

  it('does not spawn a second poller while one is already running', async () => {
    const { triggerGarminSync } = await import('../../server/lib/garminSync')
    triggerGarminSync()
    spawnMock.mockClear()
    const result = triggerGarminSync()
    expect(result.status).toBe('running')
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
