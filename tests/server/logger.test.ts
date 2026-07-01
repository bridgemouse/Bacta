import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('logEvent', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('inserts a row into app_logs', async () => {
    const { logEvent } = await import('../../server/lib/logger')
    const { default: db } = await import('../../server/db/client')

    logEvent('garmin', 'info', 'Sync triggered')

    const row = db.prepare(
      'SELECT source, level, message FROM app_logs WHERE source = ? ORDER BY id DESC LIMIT 1'
    ).get('garmin') as { source: string; level: string; message: string }
    expect(row).toEqual({ source: 'garmin', level: 'info', message: 'Sync triggered' })
  })

  it('records a created_at timestamp', async () => {
    const { logEvent } = await import('../../server/lib/logger')
    const { default: db } = await import('../../server/db/client')

    logEvent('mx4', 'error', 'Briefing generation failed')

    const row = db.prepare(
      'SELECT created_at FROM app_logs WHERE source = ? ORDER BY id DESC LIMIT 1'
    ).get('mx4') as { created_at: string }
    expect(new Date(row.created_at).getTime()).toBeGreaterThan(0)
  })

  it('trims old rows beyond the per-source cap', async () => {
    const { logEvent } = await import('../../server/lib/logger')
    const { default: db } = await import('../../server/db/client')

    for (let i = 0; i < 5; i++) {
      logEvent('trim-test', 'info', `entry ${i}`, 3)
    }

    const rows = db.prepare('SELECT message FROM app_logs WHERE source = ? ORDER BY id ASC').all('trim-test') as { message: string }[]
    expect(rows.length).toBe(3)
    expect(rows.map(r => r.message)).toEqual(['entry 2', 'entry 3', 'entry 4'])
  })

  it('does not trim rows belonging to other sources', async () => {
    const { logEvent } = await import('../../server/lib/logger')
    const { default: db } = await import('../../server/db/client')

    logEvent('source-a', 'info', 'a1', 2)
    logEvent('source-b', 'info', 'b1', 2)
    logEvent('source-a', 'info', 'a2', 2)

    const rowsA = db.prepare('SELECT message FROM app_logs WHERE source = ?').all('source-a') as { message: string }[]
    const rowsB = db.prepare('SELECT message FROM app_logs WHERE source = ?').all('source-b') as { message: string }[]
    expect(rowsA.length).toBe(2)
    expect(rowsB.length).toBe(1)
  })
})
