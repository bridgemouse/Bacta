import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'

process.env.DB_PATH = ':memory:'

describe('schema', () => {
  let db: Database.Database

  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    const client = await import('../../server/db/client')
    db = client.default
    migrate()
  })

  it('creates health_snapshots table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='health_snapshots'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates manual_inputs table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='manual_inputs'"
    ).get()
    expect(row).toBeTruthy()
  })

  // The real "drops an existing macrofactor_snapshots table" behavior is exercised by
  // tests/server/nutritionSchema.test.ts, which manually creates the table on an
  // established DB first — a fresh :memory: DB here never has the table to begin with
  // (schema.sql no longer creates it), so an "absent after migrate()" check in this
  // suite would only prove the table doesn't exist, not that migrate() dropped it.

  it('creates foods, food_log_entries, nutrition_targets tables', () => {
    for (const name of ['foods', 'food_log_entries', 'nutrition_targets']) {
      const row = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(name)
      expect(row).toBeTruthy()
    }
  })

  it('creates blood_work table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='blood_work'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('enforces readiness range on manual_inputs', () => {
    expect(() => {
      db.prepare(
        'INSERT INTO manual_inputs (date, readiness) VALUES (?, ?)'
      ).run('2026-04-25', 6)
    }).toThrow()
  })

  it('allows same metric from two sources on health_snapshots', () => {
    db.prepare(
      'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
    ).run('2026-04-25', 'hrv', 45, 'garmin')
    expect(() => {
      db.prepare(
        'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
      ).run('2026-04-25', 'hrv', 48, 'oura')
    }).not.toThrow()
  })

  it('rejects duplicate date+metric+source on health_snapshots', () => {
    db.prepare(
      'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
    ).run('2026-04-26', 'steps', 9000, 'garmin')
    expect(() => {
      db.prepare(
        'INSERT INTO health_snapshots (date, metric, value, source) VALUES (?, ?, ?, ?)'
      ).run('2026-04-26', 'steps', 9001, 'garmin')
    }).toThrow()
  })
})
