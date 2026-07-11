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
})
