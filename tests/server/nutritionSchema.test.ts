import { describe, it, expect, beforeAll } from 'vitest'

process.env.DB_PATH = ':memory:'

function tableExists(db: import('better-sqlite3').Database, name: string): boolean {
  return !!db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name)
}

describe('Nutrition schema migration', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('creates foods, food_log_entries, nutrition_targets tables', async () => {
    const { default: db } = await import('../../server/db/client')
    expect(tableExists(db, 'foods')).toBe(true)
    expect(tableExists(db, 'food_log_entries')).toBe(true)
    expect(tableExists(db, 'nutrition_targets')).toBe(true)
  })

  it('drops the dead macrofactor_snapshots table', async () => {
    const { default: db } = await import('../../server/db/client')
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(false)
  })

  it('running migrate() twice is a no-op (idempotent)', async () => {
    const { migrate } = await import('../../server/db/migrate')
    expect(() => migrate()).not.toThrow()
    const { default: db } = await import('../../server/db/client')
    expect(tableExists(db, 'foods')).toBe(true)
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(false)
  })

  it('actually drops macrofactor_snapshots when it exists on an established DB (not just a no-op on a fresh one)', async () => {
    // schema.sql no longer creates this table at all, so the prior tests only ever
    // exercise the "table never existed" no-op path. Simulate the real production
    // case — an existing DB that still has the pre-nutrition table — by creating it
    // directly, then confirm migrate()'s DROP TABLE branch actually fires.
    const { default: db } = await import('../../server/db/client')
    db.exec('CREATE TABLE IF NOT EXISTS macrofactor_snapshots (id INTEGER PRIMARY KEY)')
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(true)

    const { migrate } = await import('../../server/db/migrate')
    expect(() => migrate()).not.toThrow()
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(false)
  })
})
